import { describe, it, expect } from 'vitest';
import {
  checkCardanoPrices,
  pricedAssets,
  type CapacityFormulas,
  type CardanoPairPrice,
} from './prices.js';

const UNIT = 'aa'.repeat(28) + '534e454b';

const PAIR: CardanoPairPrice = {
  paid: { type: 'cardano:native', rawId: UNIT },
  spent: { type: 'cardano:ada', rawId: '' },
  base: '100',
  tiers: [
    { above: '1000000000', perUnit: { numerator: '11', denominator: '1000' } },
    { above: '500000000', perUnit: { numerator: '13', denominator: '1000' } },
  ],
};

describe('checkCardanoPrices', () => {
  it('accepts a token-for-ADA pair and an ADA-for-ADA pair', () => {
    const adaForAda = { ...PAIR, paid: { type: 'cardano:ada' as const, rawId: '' } };
    expect(() => checkCardanoPrices([PAIR, adaForAda])).not.toThrow();
  });

  it('refuses a pair that spends a token', () => {
    const spendsToken = { ...PAIR, spent: PAIR.paid };
    expect(() => checkCardanoPrices([spendsToken])).toThrow(/only cardano:ada can be spent/);
  });

  it('refuses two prices for the same pair', () => {
    expect(() => checkCardanoPrices([PAIR, PAIR])).toThrow(/second price for the pair/);
  });

  it('refuses tiers that do not fall strictly', () => {
    const flat = { ...PAIR, tiers: [PAIR.tiers[0], PAIR.tiers[0]] };
    expect(() => checkCardanoPrices([flat])).toThrow(/strictly falling/);
  });

  it('refuses a Midnight currency', () => {
    const midnight = { ...PAIR, paid: { type: 'midnight:shielded' as const, rawId: 'ab' } };
    expect(() => checkCardanoPrices([midnight])).toThrow(/not a Cardano asset/);
  });

  it('refuses a native unit that is not a policy id and asset name', () => {
    const short = { ...PAIR, paid: { type: 'cardano:native' as const, rawId: 'deadbeef' } };
    expect(() => checkCardanoPrices([short])).toThrow(/policy id/);
  });

  it('refuses a rawId on ADA', () => {
    const ada = { ...PAIR, spent: { type: 'cardano:ada' as const, rawId: 'lovelace' } };
    expect(() => checkCardanoPrices([ada])).toThrow(/empty rawId/);
  });
});

const FORMULA = {
  currency: { type: 'cardano:ada' as const, rawId: '' },
  basePrice: '0',
  rateNumerator: '1',
  rateDenominator: '1',
};

describe('pricedAssets', () => {
  it('returns an empty list when no assets are configured', () => {
    expect(pricedAssets({})).toEqual([]);
  });

  it('excludes DUST when only ADA is priced — this is what makes Midnight optional', () => {
    const formulas: CapacityFormulas = { ADA: [FORMULA] };
    expect(pricedAssets(formulas)).toEqual(['ADA']);
  });

  it('excludes ADA when only DUST is priced', () => {
    const formulas: CapacityFormulas = {
      DUST: [{ ...FORMULA, currency: { type: 'midnight:shielded', rawId: 'lovelace' } }],
    };
    expect(pricedAssets(formulas)).toEqual(['DUST']);
  });

  it('treats a present-but-empty array as not priced', () => {
    expect(pricedAssets({ DUST: [] })).toEqual([]);
  });

  it('returns both when both are priced', () => {
    const formulas: CapacityFormulas = {
      DUST: [{ ...FORMULA, currency: { type: 'midnight:shielded', rawId: 'lovelace' } }],
      ADA: [FORMULA],
    };
    expect(pricedAssets(formulas)).toEqual(['DUST', 'ADA']);
  });
});
