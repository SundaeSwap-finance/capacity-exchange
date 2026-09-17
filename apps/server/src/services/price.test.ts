import { describe, it, expect } from 'vitest';
import { PriceService } from './price.js';
import type { RawPriceFormula } from '../config/prices.js';

function formula(rawId: string, basePrice: string, rateNumerator = '0'): RawPriceFormula {
  return {
    currency: { type: 'midnight:shielded', rawId },
    basePrice,
    rateNumerator,
    rateDenominator: '1',
  };
}

describe('PriceService', () => {
  it('keeps a payment currency priced separately per capacity asset', () => {
    // The same token pays for both assets at very different rates. Before formulas were
    // grouped by asset, these two collided on the currency id and the last one silently won.
    const service = new PriceService({
      DUST: [formula('tusdm', '100')],
      ADA: [formula('tusdm', '5000')],
    });

    expect(service.getPrice('DUST', 'midnight:shielded:tusdm', 1n)).toMatchObject({ price: 100n });
    expect(service.getPrice('ADA', 'midnight:shielded:tusdm', 1n)).toMatchObject({ price: 5000n });
  });

  it('rejects a duplicate currency within one asset rather than picking one', () => {
    expect(
      () => new PriceService({ DUST: [formula('tusdm', '100'), formula('tusdm', '200')] }),
    ).toThrow(/Duplicate price formula for currency midnight:shielded:tusdm/);
  });

  it('distinguishes an unsold asset from an unpriced currency', () => {
    const service = new PriceService({ DUST: [formula('tusdm', '100')] });

    expect(service.getPrice('ADA', 'midnight:shielded:tusdm', 1n)).toEqual({
      status: 'unsupported-asset',
    });
    expect(service.getPrice('DUST', 'midnight:shielded:nope', 1n)).toEqual({
      status: 'unsupported-currency',
    });
  });

  it('reports only the assets it has formulas for, ignoring empty groups', () => {
    expect(new PriceService({ DUST: [formula('tusdm', '100')], ADA: [] }).listAssets()).toEqual([
      'DUST',
    ]);
  });

  it('returns undefined prices for an asset it does not sell', () => {
    const service = new PriceService({ DUST: [formula('tusdm', '100')] });
    expect(service.listPrices('ADA', 1n)).toBeUndefined();
    expect(service.listPrices('DUST', 1n)).toHaveLength(1);
  });
});
