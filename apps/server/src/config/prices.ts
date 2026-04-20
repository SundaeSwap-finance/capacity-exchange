import { Value } from '@sinclair/typebox/value';
import { Type, type Static } from '@sinclair/typebox';
import { readFileOrError } from './files.js';

const RawCurrencySchema = Type.Object({
  type: Type.Literal('midnight:shielded'),
  rawId: Type.String(),
});

const RawPriceFormulaSchema = Type.Object({
  currency: RawCurrencySchema,
  basePrice: Type.String(),
  rateNumerator: Type.String(),
  rateDenominator: Type.String(),
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
  maxPrices: Type.Array(RawPriceFormulaSchema),
});

const PriceConfigSchema = Type.Object({
  priceFormulas: Type.Array(RawPriceFormulaSchema),
  sponsorAll: Type.Optional(Type.Boolean()),
  sponsoredContracts: Type.Array(SponsoredContractSchema),
  peer: Type.Optional(PeerConfigSchema),
});

export type RawCurrency = Static<typeof RawCurrencySchema>;
export type RawPriceFormula = Static<typeof RawPriceFormulaSchema>;
export type SponsoredContract = Static<typeof SponsoredContractSchema>;
export type PeerConfig = Static<typeof PeerConfigSchema>;
export type PriceConfig = Static<typeof PriceConfigSchema>;

/** Load and validate the price config JSON file. */
export function loadPriceConfig(filePath: string): PriceConfig {
  const raw = readFileOrError(filePath, 'Failed to read price config from');
  try {
    return Value.Decode(PriceConfigSchema, JSON.parse(raw));
  } catch (err) {
    throw new Error(
      `Invalid price config in ${filePath}: ${err instanceof Error ? err.message : err}`,
    );
  }
}
