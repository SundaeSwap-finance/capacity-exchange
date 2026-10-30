/** CIP-0198 price ladders: what a service publishes in its hints, and what an offer owes under them. */

import { sameAsset, type Asset } from '../../utils/asset.js';
import {
  addRational,
  ceilRational,
  scaleRational,
  ZERO,
  type Rational,
} from '../../utils/rational.js';

/** One tier of a configured price: the rate for what the service spends while its balance is above `above`. */
export interface Tier {
  above: bigint;
  /** Units of the paid asset per unit spent. */
  perUnit: Rational;
}

/** A configured price pair. `tiers` are listed by strictly falling `above`. */
export interface PriceSchedule {
  paid: Asset;
  spent: Asset;
  /** Units of the paid asset charged per offer. */
  base: bigint;
  tiers: Tier[];
}

export interface Rung {
  /** Units of the spent asset at this rung, not cumulative. `null` is unbounded, and only allowed on the last rung. */
  supply: bigint | null;
  /** Units of the paid asset per unit spent. */
  perUnit: Rational;
}

/** A CIP-0198 `price`: what a service charges in `paid` for what it spends of `spent`. */
export interface Price {
  paid: Asset;
  spent: Asset;
  base: bigint;
  /** Filled in order. Never empty. */
  ladder: Rung[];
}

/** What an offer makes the service spend of one asset. */
export interface Spend {
  asset: Asset;
  amount: bigint;
}

/**
 * The ladder `tiers` publish while the service holds `balance` of the spent asset. Spending
 * starts at `balance` and works down, so the first rung is the tier `balance` sits in, capped
 * at `balance`, and the last ends at the lowest tier's `above`. Every rung is bounded. Empty
 * when `balance` is at or below the lowest `above`.
 */
export function sliceTiers(tiers: Tier[], balance: bigint): Rung[] {
  return tiers
    .filter((t) => t.above < balance)
    .map((t) => {
      const supply = balance - t.above;
      balance = t.above;
      return {
        supply,
        perUnit: t.perUnit,
      };
    });
}

/**
 * What filling `amount` up `ladder` costs in the paid asset, exact. `undefined` when the
 * ladder's total supply is less than `amount`.
 */
export function ladderCost(ladder: Rung[], amount: bigint): Rational | undefined {
  let result = ZERO;
  for (const r of ladder) {
    const used = r.supply === null || r.supply > amount ? amount : r.supply;
    result = addRational(result, scaleRational(r.perUnit, used));
    if (used === amount) {
      return result;
    }
    amount -= used;
  }
  return undefined;
}

/**
 * What an offer making the service spend `spends` owes in `paid`: for each spend, the `base`
 * of the (`paid`, spent) pair plus the spend's cost up that pair's ladder, summed and rounded
 * up to a whole unit. `undefined` when some spend has no pair from `paid`, or its ladder is too
 * shallow.
 */
export function owed(prices: Price[], paid: Asset, spends: Spend[]): bigint | undefined {
  let baseSum = 0n;
  let ladderSum = ZERO;
  for (const s of spends) {
    const price = prices.find((p) => sameAsset(p.paid, paid) && sameAsset(p.spent, s.asset));
    const lc = price && ladderCost(price.ladder, s.amount);
    if (!price || !lc) {
      return undefined;
    }
    ladderSum = addRational(lc, ladderSum);
    baseSum += price.base;
  }
  return baseSum + ceilRational(ladderSum);
}
