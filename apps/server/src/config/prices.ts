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

const AdaTierSchema = Type.Object(
  {
    above: Type.String(),
    rateNumerator: Type.String(),
    rateDenominator: Type.String(),
  },
  { additionalProperties: false },
);

/**
 * An ADA price, published as CIP-0198 hints: each tier's rate applies while the wallet holds more
 * lovelace than its `above`, and nothing is offered below the lowest `above`. A single tier above
 * `0` is a flat rate.
 */
const AdaPriceFormulaSchema = Type.Object(
  {
    currency: Type.Object({
      type: Type.Union([Type.Literal('cardano:ada'), Type.Literal('cardano:native')]),
      rawId: Type.String(),
    }),
    basePrice: Type.String(),
    tiers: Type.Array(AdaTierSchema, { minItems: 1 }),
  },
  { additionalProperties: false },
);

/** Flat price formulas grouped by capacity asset, as `peer.maxPrices` caps what peers charge. */
const CapacityFormulasSchema = Type.Object({
  DUST: Type.Optional(Type.Array(RawPriceFormulaSchema)),
  ADA: Type.Optional(Type.Array(RawPriceFormulaSchema)),
});

/**
 * What the server sells at: DUST at {@link RawPriceFormulaSchema} rates, ADA through hints.
 * Every asset is optional: a server that only sells DUST omits `ADA` entirely.
 */
const PriceFormulasSchema = Type.Object({
  DUST: Type.Optional(Type.Array(RawPriceFormulaSchema)),
  ADA: Type.Optional(Type.Array(AdaPriceFormulaSchema)),
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

const PriceConfigSchema = Type.Object({
  priceFormulas: PriceFormulasSchema,
  sponsorAll: Type.Optional(Type.Boolean()),
  sponsoredContracts: Type.Array(SponsoredContractSchema),
  peer: Type.Optional(PeerConfigSchema),
});

export type RawCurrency = Static<typeof RawCurrencySchema>;
export type RawPriceFormula = Static<typeof RawPriceFormulaSchema>;
export type AdaPriceFormula = Static<typeof AdaPriceFormulaSchema>;
export type CapacityFormulas = Static<typeof CapacityFormulasSchema>;
export type PriceFormulas = Static<typeof PriceFormulasSchema>;
export type SponsoredContract = Static<typeof SponsoredContractSchema>;
export type PeerConfig = Static<typeof PeerConfigSchema>;
export type PriceConfig = Static<typeof PriceConfigSchema>;

/** The assets a formula group actually prices, skipping any present but empty. */
export function pricedAssets(formulas: Partial<Record<CapacityAsset, unknown[]>>): CapacityAsset[] {
  return CAPACITY_ASSETS.filter((asset) => formulas[asset]?.length);
}

// A policy id is 28 bytes and an asset name at most 32.
const NATIVE_UNIT = /^[0-9a-f]{56}(?:[0-9a-f]{2}){0,32}$/;

function checkCardanoCurrency(currency: RawCurrency, where: string): void {
  if (currency.type === 'cardano:ada' && currency.rawId !== '') {
    throw new Error(`${where}: cardano:ada takes an empty rawId`);
  }
  if (currency.type === 'cardano:native' && !NATIVE_UNIT.test(currency.rawId)) {
    throw new Error(`${where}: rawId must be a lowercase hex policy id followed by an asset name`);
  }
}

// The CIP's wire format carries a hint's base as a CBOR uint and a rate's parts as u64.
const MAX_U64 = 2n ** 64n - 1n;

function checkU64(value: string, where: string): void {
  if (!/^\d+$/.test(value)) {
    throw new Error(`${where}: ${JSON.stringify(value)} is not a whole number`);
  }
  if (BigInt(value) > MAX_U64) {
    throw new Error(`${where}: ${value} does not fit in 64 bits`);
  }
}

function checkRate(numerator: string, denominator: string, where: string): void {
  checkU64(numerator, `${where}.rateNumerator`);
  checkU64(denominator, `${where}.rateDenominator`);
  if (BigInt(denominator) === 0n) {
    throw new Error(`${where}.rateDenominator: must not be zero`);
  }
}

/** Throws on the first ADA formula the CIP-0198 hints could not publish as configured. */
export function checkAdaFormulas(formulas: AdaPriceFormula[]): void {
  const priced = new Set<string>();
  formulas.forEach((formula, i) => {
    const where = `priceFormulas.ADA[${i}]`;
    checkCardanoCurrency(formula.currency, `${where}.currency`);
    // CIP-0198 readers reject a whole hint set that prices one pair twice.
    const id = `${formula.currency.type}:${formula.currency.rawId}`;
    if (priced.has(id)) {
      throw new Error(`${where}.currency: ${id} is priced twice`);
    }
    priced.add(id);
    checkU64(formula.basePrice, `${where}.basePrice`);
    formula.tiers.forEach((tier, j) => {
      const at = `${where}.tiers[${j}]`;
      checkU64(tier.above, `${at}.above`);
      checkRate(tier.rateNumerator, tier.rateDenominator, at);
      if (j > 0 && BigInt(tier.above) >= BigInt(formula.tiers[j - 1].above)) {
        throw new Error(`${at}: tiers must be listed by strictly falling 'above'`);
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
  // A server with no formulas can quote nothing, which is never what an operator meant.
  if (pricedAssets(config.priceFormulas).length === 0) {
    throw new Error(
      `Invalid price config in ${filePath}: priceFormulas must price at least one of ${CAPACITY_ASSETS.join(', ')}`,
    );
  }
  try {
    checkAdaFormulas(config.priceFormulas.ADA ?? []);
  } catch (err) {
    throw new Error(`Invalid price config in ${filePath}: ${(err as Error).message}`);
  }
  return config;
}
