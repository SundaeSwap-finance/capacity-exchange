import { describe, it, expect } from 'vitest';
import { ladderCost, owed, sliceTiers, type Price, type Rung, type Tier } from './ladder.js';
import type { Asset } from '../../utils/asset.js';
import type { Rational } from '../../utils/rational.js';

const ADA: Asset = { type: 'ada' };
const TOKEN: Asset = { type: 'native', unit: 'aa'.repeat(28) + '534e454b' };
const OTHER: Asset = { type: 'native', unit: 'bb'.repeat(28) };

const r = (numerator: bigint, denominator = 1n): Rational => ({ numerator, denominator });

/** Compares by value, so an unreduced fraction still matches. */
function expectRational(actual: Rational | undefined, expected: Rational) {
  expect(actual).toBeDefined();
  expect(actual!.numerator * expected.denominator).toBe(expected.numerator * actual!.denominator);
}

describe('sliceTiers', () => {
  const R1 = r(11n, 1000n);
  const R2 = r(13n, 1000n);
  const R3 = r(17n, 1000n);
  const TIERS: Tier[] = [
    { above: 1000n, perUnit: R1 },
    { above: 500n, perUnit: R2 },
    { above: 100n, perUnit: R3 },
  ];

  it('starts at the balance and ends at the lowest tier', () => {
    expect(sliceTiers(TIERS, 1200n)).toEqual([
      { supply: 200n, perUnit: R1 },
      { supply: 500n, perUnit: R2 },
      { supply: 400n, perUnit: R3 },
    ]);
  });

  it('skips the tiers above the balance', () => {
    expect(sliceTiers(TIERS, 700n)).toEqual([
      { supply: 200n, perUnit: R2 },
      { supply: 400n, perUnit: R3 },
    ]);
  });

  it('treats a balance on a boundary as belonging to the tier below it', () => {
    expect(sliceTiers(TIERS, 1000n)).toEqual([
      { supply: 500n, perUnit: R2 },
      { supply: 400n, perUnit: R3 },
    ]);
  });

  it('publishes nothing at or below the lowest tier', () => {
    expect(sliceTiers(TIERS, 100n)).toEqual([]);
    expect(sliceTiers(TIERS, 50n)).toEqual([]);
  });

  it('turns a single tier into one bounded rung', () => {
    expect(sliceTiers([{ above: 100n, perUnit: R1 }], 300n)).toEqual([
      { supply: 200n, perUnit: R1 },
    ]);
  });
});

describe('ladderCost', () => {
  const OPEN: Rung[] = [
    { supply: 10n, perUnit: r(1n) },
    { supply: 20n, perUnit: r(2n) },
    { supply: null, perUnit: r(3n) },
  ];
  const BOUNDED = OPEN.slice(0, 2);

  it('costs nothing for nothing', () => {
    expectRational(ladderCost(OPEN, 0n), r(0n));
  });

  it('prices within the first rung at its rate', () => {
    expectRational(ladderCost(OPEN, 5n), r(5n));
    expectRational(ladderCost(OPEN, 10n), r(10n));
  });

  it('fills the rungs in order', () => {
    expectRational(ladderCost(OPEN, 25n), r(10n + 15n * 2n));
  });

  it('carries on up an unbounded last rung', () => {
    expectRational(ladderCost(OPEN, 100n), r(10n + 20n * 2n + 70n * 3n));
  });

  it('fills a bounded ladder exactly', () => {
    expectRational(ladderCost(BOUNDED, 30n), r(50n));
  });

  it('does not apply past a bounded ladder', () => {
    expect(ladderCost(BOUNDED, 31n)).toBeUndefined();
  });

  it('keeps fractions exact', () => {
    expectRational(ladderCost([{ supply: null, perUnit: r(1n, 3n) }], 10n), r(10n, 3n));
  });

  it('costs nothing at a zero rate', () => {
    expectRational(ladderCost([{ supply: 2_000_000n, perUnit: r(0n) }], 1_500_000n), r(0n));
  });
});

describe('owed', () => {
  const TOKEN_FOR_ADA: Price = {
    paid: TOKEN,
    spent: ADA,
    base: 100n,
    ladder: [{ supply: 1000n, perUnit: r(3n, 2n) }],
  };
  const TOKEN_FOR_OTHER: Price = {
    paid: TOKEN,
    spent: OTHER,
    base: 7n,
    ladder: [{ supply: null, perUnit: r(1n) }],
  };

  it('charges the base plus the ladder cost', () => {
    expect(owed([TOKEN_FOR_ADA], TOKEN, [{ asset: ADA, amount: 10n }])).toBe(115n);
  });

  it('rounds up to a whole unit', () => {
    expect(owed([TOKEN_FOR_ADA], TOKEN, [{ asset: ADA, amount: 11n }])).toBe(117n);
  });

  it('rounds once, on the total', () => {
    const half = (spent: Asset): Price => ({
      paid: TOKEN,
      spent,
      base: 0n,
      ladder: [{ supply: null, perUnit: r(1n, 2n) }],
    });
    const spends = [
      { asset: ADA, amount: 1n },
      { asset: OTHER, amount: 1n },
    ];
    expect(owed([half(ADA), half(OTHER)], TOKEN, spends)).toBe(1n);
  });

  it('sums the pairs for every asset spent', () => {
    const spends = [
      { asset: ADA, amount: 10n },
      { asset: OTHER, amount: 4n },
    ];
    expect(owed([TOKEN_FOR_ADA, TOKEN_FOR_OTHER], TOKEN, spends)).toBe(115n + 11n);
  });

  it('does not apply when a spent asset has no pair from the paid asset', () => {
    const spends = [
      { asset: ADA, amount: 10n },
      { asset: OTHER, amount: 4n },
    ];
    expect(owed([TOKEN_FOR_ADA], TOKEN, spends)).toBeUndefined();
  });

  it('does not apply for a paid asset with no prices', () => {
    expect(owed([TOKEN_FOR_ADA], OTHER, [{ asset: ADA, amount: 10n }])).toBeUndefined();
    expect(owed([TOKEN_FOR_ADA], ADA, [{ asset: ADA, amount: 10n }])).toBeUndefined();
  });

  it('does not apply when the ladder is too shallow', () => {
    expect(owed([TOKEN_FOR_ADA], TOKEN, [{ asset: ADA, amount: 1001n }])).toBeUndefined();
  });

  it('owes nothing under a sponsor price', () => {
    const sponsor: Price = {
      paid: ADA,
      spent: ADA,
      base: 0n,
      ladder: [{ supply: 2_000_000n, perUnit: r(0n) }],
    };
    expect(owed([sponsor], ADA, [{ asset: ADA, amount: 400_000n }])).toBe(0n);
  });

  it('matches assets by value, not by object', () => {
    const fromConfig: Price = { ...TOKEN_FOR_ADA, paid: { ...TOKEN }, spent: { type: 'ada' } };
    const spends = [{ asset: { type: 'ada' } as Asset, amount: 10n }];
    expect(owed([fromConfig], { ...TOKEN }, spends)).toBe(115n);
  });
});
