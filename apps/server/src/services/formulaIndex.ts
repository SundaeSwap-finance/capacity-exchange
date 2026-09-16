import {
  CAPACITY_ASSETS,
  type CapacityAsset,
  type CapacityFormulas,
  type RawCurrency,
  type RawPriceFormula,
} from '../config/prices.js';

export interface IndexedCurrency extends RawCurrency {
  id: string;
}

export interface IndexedFormula extends RawPriceFormula {
  currency: IndexedCurrency;
}

export interface EvaluatedPrice {
  price: bigint;
  currency: IndexedCurrency;
}

/** Indexes price formulas by currency id. Shared by `PriceService` and `PeerPriceService`. */
export class FormulaIndex {
  readonly #byId: Map<string, IndexedFormula>;

  constructor(formulas: RawPriceFormula[]) {
    this.#byId = new Map();
    for (const formula of formulas) {
      const id = computeCurrencyId(formula.currency);
      // Last-write-wins here would silently apply one currency's rate to another's config.
      if (this.#byId.has(id)) {
        throw new Error(`Duplicate price formula for currency ${id}`);
      }
      this.#byId.set(id, {
        ...formula,
        currency: { ...formula.currency, id },
      });
    }
  }

  /** Evaluate the formula keyed by the given currency id. */
  evaluateById(id: string, specks: bigint): EvaluatedPrice | undefined {
    const formula = this.#byId.get(id);
    if (!formula) {
      return undefined;
    }
    return { price: evaluateFormula(formula, specks), currency: formula.currency };
  }

  /** Evaluate every indexed formula. Order follows insertion order. */
  evaluateAll(specks: bigint): EvaluatedPrice[] {
    return [...this.#byId.values()].map((formula) => ({
      price: evaluateFormula(formula, specks),
      currency: formula.currency,
    }));
  }
}

// price = basePrice + specks * (rateNumerator / rateDenominator)
// All arithmetic is bigint to avoid precision loss on large speck values.
function evaluateFormula(formula: IndexedFormula, specks: bigint): bigint {
  return (
    BigInt(formula.basePrice) +
    (specks * BigInt(formula.rateNumerator)) / BigInt(formula.rateDenominator)
  );
}

export function computeCurrencyId(currency: { type: string; rawId: string }): string {
  return `${currency.type}:${currency.rawId}`;
}

/**
 * Builds one {@link FormulaIndex} per capacity asset the group prices. Assets with no
 * formulas are absent from the map, so a lookup miss means "this server doesn't sell that".
 */
export function indexByAsset(formulas: CapacityFormulas): Map<CapacityAsset, FormulaIndex> {
  const byAsset = new Map<CapacityAsset, FormulaIndex>();
  for (const asset of CAPACITY_ASSETS) {
    const assetFormulas = formulas[asset];
    if (assetFormulas?.length) {
      byAsset.set(asset, new FormulaIndex(assetFormulas));
    }
  }
  return byAsset;
}
