import { Value } from '@sinclair/typebox/value';
import { Type, type Static } from '@sinclair/typebox';
import { readFileOrError } from './files.js';

/** Every member of {@link CapacityAssetSchema}, for iterating. Typed so a typo won't compile. */
export const CAPACITY_ASSETS = ['DUST', 'ADA'] as const;
export type CapacityAsset = (typeof CAPACITY_ASSETS)[number];

/**
 * A capacity asset is what a server sells: the thing a caller needs in order to get their
 * transaction on-chain. `DUST` pays Midnight fees; `ADA` pays Cardano fees.
 *
 * The same identifier is the key in `priceFormulas` and the asset the API reports (in `/`'s
 * `capacityAssets` and each `/api/metrics` capacity entry), so an operator's config and the wire
 * agree by construction.
 *
 * Weird definition is a workaround for a bug with openapi-generator
 */
export const CapacityAssetSchema = { ...Type.String(), enum: CAPACITY_ASSETS };

const RawCurrencySchema = Type.Object({
  type: Type.Union([
    Type.Literal('midnight:shielded'),
    Type.Literal('midnight:unshielded'),
    // ADA itself carries no rawId, so its id is the bare `cardano:ada:`. A native asset's
    // rawId is its unit (policy id followed by the hex asset name).
    Type.Literal('cardano:ada'),
    Type.Literal('cardano:native'),
  ]),
  rawId: Type.String(),
});

const RawPriceFormulaSchema = Type.Object({
  currency: RawCurrencySchema,
  basePrice: Type.String(),
  rateNumerator: Type.String(),
  rateDenominator: Type.String(),
});

/**
 * Price formulas grouped by the capacity asset they price.
 * Every asset is optional: a server that only sells DUST omits `ADA` entirely.
 */
const CapacityFormulasSchema = Type.Object({
  DUST: Type.Optional(Type.Array(RawPriceFormulaSchema)),
  ADA: Type.Optional(Type.Array(RawPriceFormulaSchema)),
});

const CircuitFilterSchema = Type.Union([
  Type.Object({ type: Type.Literal('all') }),
  Type.Object({ type: Type.Literal('subset'), circuitNames: Type.Array(Type.String()) }),
]);

const SponsoredContractSchema = Type.Object({
  contractAddress: Type.String(),
  circuits: CircuitFilterSchema,
});

const PeerConfigSchema = Type.Object({
  maxPrices: CapacityFormulasSchema,
});

const Natural = Type.String({ pattern: '^\\d+$' });

const RationalSchema = Type.Object({
  numerator: Natural,
  denominator: Type.String({ pattern: '^0*[1-9]\\d*$' }),
});

const CardanoTierSchema = Type.Object({
  // Lovelace of the spent asset the service holds; the tier prices what it spends above this.
  above: Natural,
  // Units of the paid asset per unit spent.
  perUnit: RationalSchema,
});

/**
 * One CIP-0198 price pair. Its published ladder is the part of `tiers` the service's current
 * balance of `spent` covers, so nothing is sold below the lowest tier's `above`.
 */
const CardanoPairPriceSchema = Type.Object({
  paid: RawCurrencySchema,
  spent: RawCurrencySchema,
  // Units of the paid asset charged per offer.
  base: Natural,
  tiers: Type.Array(CardanoTierSchema, { minItems: 1 }),
});

const CardanoPricingSchema = Type.Object({
  prices: Type.Array(CardanoPairPriceSchema),
});

const PriceConfigSchema = Type.Object({
  priceFormulas: CapacityFormulasSchema,
  sponsorAll: Type.Optional(Type.Boolean()),
  sponsoredContracts: Type.Array(SponsoredContractSchema),
  peer: Type.Optional(PeerConfigSchema),
  cardano: Type.Optional(CardanoPricingSchema),
});

export type RawCurrency = Static<typeof RawCurrencySchema>;
export type RawPriceFormula = Static<typeof RawPriceFormulaSchema>;
export type CapacityFormulas = Static<typeof CapacityFormulasSchema>;
export type SponsoredContract = Static<typeof SponsoredContractSchema>;
export type PeerConfig = Static<typeof PeerConfigSchema>;
export type CardanoPairPrice = Static<typeof CardanoPairPriceSchema>;
export type PriceConfig = Static<typeof PriceConfigSchema>;

/** The assets a formula group actually prices, skipping any present but empty. */
export function pricedAssets(formulas: CapacityFormulas): CapacityAsset[] {
  return CAPACITY_ASSETS.filter((asset) => formulas[asset]?.length);
}

// A policy id is 28 bytes and an asset name at most 32.
const NATIVE_UNIT = /^[0-9a-f]{56}(?:[0-9a-f]{2}){0,32}$/;

function checkCardanoCurrency(currency: RawCurrency, where: string): void {
  if (currency.type === 'cardano:ada') {
    if (currency.rawId !== '') {
      throw new Error(`${where}: cardano:ada takes an empty rawId`);
    }
  } else if (currency.type === 'cardano:native') {
    if (!NATIVE_UNIT.test(currency.rawId)) {
      throw new Error(
        `${where}: rawId must be a lowercase hex policy id followed by an asset name`,
      );
    }
  } else {
    throw new Error(`${where}: ${currency.type} is not a Cardano asset`);
  }
}

// The CIP's wire format carries `base` as a CBOR uint and a rate's parts as u64.
const MAX_U64 = 2n ** 64n - 1n;

function checkU64(value: string, where: string): void {
  if (BigInt(value) > MAX_U64) {
    throw new Error(`${where}: ${value} does not fit in 64 bits`);
  }
}

/** Throws on the first CIP-0198 price pair the hints could not publish as configured. */
export function checkCardanoPrices(prices: CardanoPairPrice[]): void {
  const pairs = new Set<string>();
  prices.forEach((price, i) => {
    const where = `cardano.prices[${i}]`;
    checkCardanoCurrency(price.paid, `${where}.paid`);
    checkCardanoCurrency(price.spent, `${where}.spent`);
    // The offer service can only supply ADA to a batch.
    if (price.spent.type !== 'cardano:ada') {
      throw new Error(`${where}.spent: only cardano:ada can be spent`);
    }
    const pair = `${price.paid.type}:${price.paid.rawId}/${price.spent.type}:${price.spent.rawId}`;
    if (pairs.has(pair)) {
      throw new Error(`${where}: a second price for the pair ${pair}`);
    }
    pairs.add(pair);
    checkU64(price.base, `${where}.base`);
    price.tiers.forEach((tier, j) => {
      checkU64(tier.perUnit.numerator, `${where}.tiers[${j}].perUnit.numerator`);
      checkU64(tier.perUnit.denominator, `${where}.tiers[${j}].perUnit.denominator`);
      if (j > 0 && BigInt(tier.above) >= BigInt(price.tiers[j - 1].above)) {
        throw new Error(`${where}.tiers[${j}]: tiers must be listed by strictly falling 'above'`);
      }
    });
  });
}

/** Load and validate the price config JSON file. */
export function loadPriceConfig(filePath: string): PriceConfig {
  const raw = readFileOrError(filePath, 'Failed to read price config from');
  let config: PriceConfig;
  try {
    config = Value.Decode(PriceConfigSchema, JSON.parse(raw));
  } catch (err) {
    throw new Error(
      `Invalid price config in ${filePath}: ${err instanceof Error ? err.message : err}`,
    );
  }
  // A server with no prices can sell nothing, which is never what an operator meant.
  if (pricedAssets(config.priceFormulas).length === 0 && !config.cardano?.prices.length) {
    throw new Error(
      `Invalid price config in ${filePath}: priceFormulas must price at least one of ${CAPACITY_ASSETS.join(', ')}, or cardano.prices must be set`,
    );
  }
  try {
    checkCardanoPrices(config.cardano?.prices ?? []);
  } catch (err) {
    throw new Error(`Invalid price config in ${filePath}: ${(err as Error).message}`);
  }
  return config;
}
