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
  describe('with DUST formulas only', () => {
    const read = capacityAssetsWith(['DUST'], false);
    it('lists DUST', async () => {
      expect(await read()).toEqual(['DUST']);
    });
  });

  describe('with hints only', () => {
    const read = capacityAssetsWith([], true);
    it('lists ADA', async () => {
      expect(await read()).toEqual(['ADA']);
    });
  });

  describe('with hints and DUST formulas', () => {
    const read = capacityAssetsWith(['DUST'], true);
    it('lists ADA after DUST', async () => {
      expect(await read()).toEqual(['DUST', 'ADA']);
    });
  });
});
