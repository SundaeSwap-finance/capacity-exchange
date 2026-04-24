import type { RawPriceFormula } from '../config/prices.js';
import { FormulaIndex, type IndexedCurrency } from './formulaIndex.js';

export type Currency = IndexedCurrency;

export interface Price {
  amount: string;
  currency: Currency;
}

export type GetPriceResult =
  | { status: 'ok'; price: bigint; currency: Currency }
  | { status: 'unsupported-currency' };

export class PriceService {
  readonly #index: FormulaIndex;
  constructor(formulas: RawPriceFormula[]) {
    this.#index = new FormulaIndex(formulas);
  }

  getPrice(id: string, specks: bigint): GetPriceResult {
    const result = this.#index.evaluateById(id, specks);
    if (!result) {
      return { status: 'unsupported-currency' };
    }
    return { status: 'ok', price: result.price, currency: result.currency };
  }

  listPrices(specks: bigint): Price[] {
    return this.#index.evaluateAll(specks).map(({ price, currency }) => ({
      amount: price.toString(),
      currency,
    }));
  }
}
