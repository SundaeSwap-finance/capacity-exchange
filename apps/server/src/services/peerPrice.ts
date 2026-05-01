import type { RawPriceFormula } from '../config/prices.js';
import { FormulaIndex, computeCurrencyId } from './formulaIndex.js';

/**
 * Max prices, keyed per currency, this server will pay peer exchanges for DUST
 * during sponsor fallback. Counterpart to {@link PriceService}, which prices
 * DUST this server sells.
 */
export class PeerPriceService {
  readonly #index: FormulaIndex;
  constructor(maxPrices: RawPriceFormula[]) {
    this.#index = new FormulaIndex(maxPrices);
  }

  /**
   * Max amount this server will pay a peer for `specks` DUST in the given
   * currency, or `undefined` if the currency is not allowlisted.
   */
  getMaxPrice(currency: { type: string; rawId: string }, specks: bigint): bigint | undefined {
    return this.#index.evaluateById(computeCurrencyId(currency), specks)?.price;
  }
}
