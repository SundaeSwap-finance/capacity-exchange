import type { CapacityAsset, CapacityFormulas } from '../config/prices.js';
import { FormulaIndex, computeCurrencyId, indexByAsset } from './formulaIndex.js';

/**
 * Max prices, keyed per capacity asset and then per currency, this server will pay peer
 * exchanges. Mirrors `PriceService`, but bounds what this server buys rather than
 * quoting what it sells.
 */
export class PeerPriceService {
  readonly #byAsset: Map<CapacityAsset, FormulaIndex>;

  constructor(maxPrices: CapacityFormulas) {
    this.#byAsset = indexByAsset(maxPrices);
  }

  /**
   * Max amount this server will pay a peer for `amount` of `asset` in the given currency,
   * or `undefined` if the asset or currency isn't allowlisted.
   */
  getMaxPrice(
    asset: CapacityAsset,
    currency: { type: string; rawId: string },
    amount: bigint,
  ): bigint | undefined {
    return this.#byAsset.get(asset)?.evaluateById(computeCurrencyId(currency), amount)?.price;
  }
}
