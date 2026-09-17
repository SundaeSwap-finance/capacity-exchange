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
 * The same identifier is the key in `priceFormulas` and the value of `/api/prices?currency=`,
 * so an operator's config and the wire agree by construction.
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

const PriceConfigSchema = Type.Object({
  priceFormulas: CapacityFormulasSchema,
  sponsorAll: Type.Optional(Type.Boolean()),
  sponsoredContracts: Type.Array(SponsoredContractSchema),
  peer: Type.Optional(PeerConfigSchema),
});

export type RawCurrency = Static<typeof RawCurrencySchema>;
export type RawPriceFormula = Static<typeof RawPriceFormulaSchema>;
export type CapacityFormulas = Static<typeof CapacityFormulasSchema>;
export type SponsoredContract = Static<typeof SponsoredContractSchema>;
export type PeerConfig = Static<typeof PeerConfigSchema>;
export type PriceConfig = Static<typeof PriceConfigSchema>;

/** The assets a formula group actually prices, skipping any present but empty. */
export function pricedAssets(formulas: CapacityFormulas): CapacityAsset[] {
  return CAPACITY_ASSETS.filter((asset) => formulas[asset]?.length);
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
  return config;
}
