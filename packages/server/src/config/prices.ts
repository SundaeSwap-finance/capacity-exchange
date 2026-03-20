import { Value } from '@sinclair/typebox/value';
import { Type, type Static } from '@sinclair/typebox';
import { readFileOrError } from './files.js';

const PriceFormulaSchema = Type.Object({
  currency: Type.String(),
  basePrice: Type.String(),
  rateNumerator: Type.String(),
  rateDenominator: Type.String(),
});

const CircuitFilterSchema = Type.Union([
  Type.Object({ type: Type.Literal('all') }),
  Type.Object({ type: Type.Literal('subset'), circuitNames: Type.Array(Type.String()) }),
]);

const FundedContractSchema = Type.Object({
  contractAddress: Type.String(),
  circuits: CircuitFilterSchema,
});

const PriceConfigSchema = Type.Object({
  priceFormulas: Type.Array(PriceFormulaSchema),
  fundedContracts: Type.Array(FundedContractSchema),
});

export type PriceFormula = Static<typeof PriceFormulaSchema>;
export type FundedContract = Static<typeof FundedContractSchema>;
export type PriceConfig = Static<typeof PriceConfigSchema>;

/** Load and validate the price config JSON file. */
export function loadPriceConfig(filePath: string): PriceConfig {
  const raw = readFileOrError(filePath, 'Failed to read price config from');
  try {
    return Value.Decode(PriceConfigSchema, JSON.parse(raw));
  } catch (err) {
    throw new Error(`Invalid price config in ${filePath}: ${err instanceof Error ? err.message : err}`);
  }
}
