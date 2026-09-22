import { describe, it, expect } from 'vitest';
import { pricedAssets, type CapacityFormulas } from './prices.js';

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
