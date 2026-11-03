import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, it, expect } from 'vitest';
import {
  checkAdaFormulas,
  loadPriceConfig,
  pricedAssets,
  type AdaPriceFormula,
  type CapacityFormulas,
} from './prices.js';

const UNIT = 'aa'.repeat(28) + '534e454b';

const TIERED: AdaPriceFormula = {
  currency: { type: 'cardano:native', rawId: UNIT },
  basePrice: '100',
  tiers: [
    { above: '1000000000', rateNumerator: '11', rateDenominator: '1000' },
    { above: '500000000', rateNumerator: '13', rateDenominator: '1000' },
  ],
};
const TIER = TIERED.tiers[0];
const withTier = (tier: object) => ({ ...TIERED, tiers: [{ ...TIER, ...tier }] });

describe('checkAdaFormulas', () => {
  it('accepts a token price and one paid in ADA', () => {
    const adaForAda = { ...TIERED, currency: { type: 'cardano:ada' as const, rawId: '' } };
    expect(() => checkAdaFormulas([TIERED, adaForAda])).not.toThrow();
  });

  it('refuses a currency priced twice', () => {
    expect(() => checkAdaFormulas([TIERED, TIERED])).toThrow(/priced twice/);
  });

  it('refuses tiers that do not fall strictly', () => {
    const level = { ...TIERED, tiers: [TIER, TIER] };
    expect(() => checkAdaFormulas([level])).toThrow(/strictly falling/);
  });

  it('refuses a zero rate denominator', () => {
    expect(() => checkAdaFormulas([withTier({ rateDenominator: '0' })])).toThrow(
      /tiers\[0\]\.rateDenominator: must not be zero/,
    );
  });

  it('refuses a number that is not whole', () => {
    expect(() => checkAdaFormulas([withTier({ rateNumerator: '1.5' })])).toThrow(/whole number/);
    expect(() => checkAdaFormulas([withTier({ above: '-1' })])).toThrow(
      /tiers\[0\]\.above: .* whole number/,
    );
  });

  it('refuses a native unit that is not a policy id and asset name', () => {
    const short = { ...TIERED, currency: { type: 'cardano:native' as const, rawId: 'deadbeef' } };
    expect(() => checkAdaFormulas([short])).toThrow(/policy id/);
  });

  it('refuses a rawId on ADA', () => {
    const ada = { ...TIERED, currency: { type: 'cardano:ada' as const, rawId: 'lovelace' } };
    expect(() => checkAdaFormulas([ada])).toThrow(/empty rawId/);
  });

  describe('64-bit limits', () => {
    const MAX = (2n ** 64n - 1n).toString();
    const OVER = (2n ** 64n).toString();

    it('accepts values up to 2^64 - 1', () => {
      const max = withTier({ above: MAX, rateNumerator: MAX, rateDenominator: MAX });
      expect(() => checkAdaFormulas([{ ...max, basePrice: MAX }])).not.toThrow();
    });

    it('refuses a base price over 64 bits', () => {
      expect(() => checkAdaFormulas([{ ...TIERED, basePrice: OVER }])).toThrow(
        /basePrice: .* 64 bits/,
      );
    });

    it('refuses a rate over 64 bits', () => {
      expect(() => checkAdaFormulas([withTier({ rateNumerator: OVER })])).toThrow(
        /tiers\[0\]\.rateNumerator: .* 64 bits/,
      );
    });
  });
});

describe('loadPriceConfig', () => {
  function load(config: unknown): ReturnType<typeof loadPriceConfig> {
    const file = join(mkdtempSync(join(tmpdir(), 'prices-')), 'price-config.json');
    writeFileSync(file, JSON.stringify(config));
    return loadPriceConfig(file);
  }
  const config = (ada: unknown[]) => ({ priceFormulas: { ADA: ada }, sponsoredContracts: [] });

  it('accepts a tiered ADA formula', () => {
    expect(load(config([TIERED])).priceFormulas.ADA).toEqual([TIERED]);
  });

  it('refuses a flat rate on an ADA formula', () => {
    const flat = { ...TIERED, rateNumerator: '1', rateDenominator: '1' };
    expect(() => load(config([flat]))).toThrow(/Invalid price config/);
  });

  it('refuses an ADA formula paid in a Midnight currency', () => {
    const midnight = { ...TIERED, currency: { type: 'midnight:shielded', rawId: 'ab' } };
    expect(() => load(config([midnight]))).toThrow(/Invalid price config/);
  });

  it('refuses a misspelt field in a tier', () => {
    const { rateDenominator, ...rest } = TIER;
    const tiers = [{ ...rest, rateDenomintor: rateDenominator }];
    expect(() => load(config([{ ...TIERED, tiers }]))).toThrow(/Invalid price config/);
  });

  it('refuses an ADA formula without tiers', () => {
    expect(() => load(config([{ ...TIERED, tiers: [] }]))).toThrow(/Invalid price config/);
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
