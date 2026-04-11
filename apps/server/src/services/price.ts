import type { RawCurrency, RawPriceFormula } from '../config/prices.js';

export interface Currency extends RawCurrency {
  id: string;
}

interface PriceFormula extends RawPriceFormula {
  currency: Currency;
}

export interface Price {
  amount: string;
  currency: Currency;
}

export type GetPriceResult =
  | { status: 'ok'; price: bigint; currency: Currency }
  | { status: 'unsupported-currency' };

export class PriceService {
  readonly #formulas: Map<string, PriceFormula>;
  constructor(formulas: RawPriceFormula[]) {
    this.#formulas = new Map();
    for (const formula of formulas) {
      const id = computeCurrencyId(formula.currency);
      this.#formulas.set(id, {
        ...formula,
        currency: {
          ...formula.currency,
          id,
        },
      });
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
      currency: formula.currency,
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

function computeCurrencyId(currency: Omit<Currency, 'id'>): string {
  return `${currency.type}:${currency.identifier}`;
}
