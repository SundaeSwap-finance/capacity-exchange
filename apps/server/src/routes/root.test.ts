import { describe, it, expect } from 'vitest';
import rootRoutes from './root.js';
import { useRouteTestApp } from './test-utils.js';
import type { CapacityAsset } from '../config/prices.js';

function capacityAssetsWith(formulaAssets: CapacityAsset[], hints: boolean) {
  const app = useRouteTestApp({
    decorations: {
      config: {},
      priceService: { listAssets: () => formulaAssets },
      cardanoHintService: hints ? { hints: () => [] } : null,
    },
    routes: { plugin: rootRoutes, prefix: '' },
  });
  return async () => {
    const res = await app.get().inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(200);
    return res.json().capacityAssets;
  };
}

describe('GET / capacityAssets', () => {
  describe('with formulas only', () => {
    const read = capacityAssetsWith(['DUST'], false);
    it('lists the formula assets', async () => {
      expect(await read()).toEqual(['DUST']);
    });
  });

  describe('with hints only', () => {
    const read = capacityAssetsWith([], true);
    it('lists ADA', async () => {
      expect(await read()).toEqual(['ADA']);
    });
  });

  describe('with hints and formulas for DUST', () => {
    const read = capacityAssetsWith(['DUST'], true);
    it('adds ADA after the formula assets', async () => {
      expect(await read()).toEqual(['DUST', 'ADA']);
    });
  });

  describe('with hints and a formula for ADA', () => {
    const read = capacityAssetsWith(['ADA'], true);
    it('lists ADA once', async () => {
      expect(await read()).toEqual(['ADA']);
    });
  });
});
