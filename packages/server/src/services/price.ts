import type { PriceFormula } from '../config/prices.js';

export interface Price {
  amount: string;
  currency: string;
}

export type GetPriceResult = { status: 'ok'; price: bigint } | { status: 'unsupported-currency' };

export class PriceService {
  readonly #formulas: Map<string, PriceFormula>;
  constructor(formulas: PriceFormula[]) {
    this.#formulas = new Map();
    for (const formula of formulas) {
      this.#formulas.set(formula.currency, formula);
    }
  }

  getPrice(currency: string, specks: bigint): GetPriceResult {
    const formula = this.#formulas.get(currency);
    if (!formula) {
      return { status: 'unsupported-currency' };
    }
    return {
      status: 'ok',
      price: this.#computePrice(specks, formula),
    };
  }

  listPrices(specks: bigint): Price[] {
    const prices: Price[] = [];
    for (const formula of this.#formulas.values()) {
      prices.push({
        amount: this.#computePrice(specks, formula).toString(),
        currency: formula.currency,
      });
    }
    return prices;
  }

  // price = basePrice + specks * (rateNumerator / rateDenominator)
  // All arithmetic is bigint to avoid precision loss on large speck values.
  #computePrice(specks: bigint, formula: PriceFormula): bigint {
    return (
      BigInt(formula.basePrice) +
      (specks * BigInt(formula.rateNumerator)) / BigInt(formula.rateDenominator)
    );
  }
}
