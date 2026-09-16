import type { CapacityAsset, CapacityFormulas } from '../config/prices.js';
import { FormulaIndex, indexByAsset, type IndexedCurrency } from './formulaIndex.js';

export type Currency = IndexedCurrency;

export interface Price {
  amount: string;
  currency: Currency;
}

export type GetPriceResult =
  | { status: 'ok'; price: bigint; currency: Currency }
  | { status: 'unsupported-asset' }
  | { status: 'unsupported-currency' };

export class PriceService {
  readonly #byAsset: Map<CapacityAsset, FormulaIndex>;

  constructor(formulas: CapacityFormulas) {
    this.#byAsset = indexByAsset(formulas);
  }

  /** The capacity assets this server sells. */
  listAssets(): CapacityAsset[] {
    return [...this.#byAsset.keys()];
  }

  /** Price `amount` of `asset`, payable in the currency identified by `id`. */
  getPrice(asset: CapacityAsset, id: string, amount: bigint): GetPriceResult {
    const index = this.#byAsset.get(asset);
    if (!index) {
      return { status: 'unsupported-asset' };
    }
    const result = index.evaluateById(id, amount);
    if (!result) {
      return { status: 'unsupported-currency' };
    }
    return { status: 'ok', price: result.price, currency: result.currency };
  }

  /**
   * Every price this server will quote for `amount` of `asset`. `undefined` means the
   * server doesn't sell that asset at all, which the caller reports differently from an
   * asset that happens to have no payable currencies.
   */
  listPrices(asset: CapacityAsset, amount: bigint): Price[] | undefined {
    return this.#byAsset
      .get(asset)
      ?.evaluateAll(amount)
      .map(({ price, currency }) => ({
        amount: price.toString(),
        currency,
      }));
  }
}
