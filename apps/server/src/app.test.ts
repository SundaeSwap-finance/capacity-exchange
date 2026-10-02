import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import type { AppConfig } from './loadConfig.js';

/**
 * No `midnight` field — this is what a real ADA-only server looks like. Builds
 * the actual app, no mocks, to prove the whole plugin chain handles it.
 */
const ADA_ONLY_CONFIG: AppConfig = {
  port: 0,
  quoteTtlSeconds: 300,
  offerTtlSeconds: 2,
  priceFormulas: {
    ADA: [
      {
        currency: { type: 'cardano:ada', rawId: '' },
        basePrice: '0',
        rateNumerator: '1',
        rateDenominator: '1',
      },
    ],
  },
  sponsorAll: false,
  sponsoredContracts: [],
  quoteSecretFile: '.quote-secret.app-test.key',
  capacityExchangeUrls: [],
};

describe('buildApp — ADA-only server (no Midnight configuration)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp(ADA_ONLY_CONFIG, { logger: false });
    // The real assertion: this must not throw. Before this fix, the metrics
    // plugin unconditionally required a Midnight wallet/UTXO service and
    // crashed here.
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports readiness without attempting to reach a Midnight network', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/ready' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('reports ADA as the only capacity asset and no Midnight chain from the root endpoint', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.capacityAssets).toEqual(['ADA']);
    expect(body.chains).toEqual({});
  });

  it('serves metrics with no DUST capacity', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/metrics' });
    expect(res.statusCode).toBe(200);
    expect(res.json().capacity).toEqual([]);
  });

  it('still prices the capacity asset it actually sells (ADA)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/cardano/prices?amount=1000000' });
    expect(res.statusCode).toBe(200);
    expect(res.json().prices).toBeInstanceOf(Array);
  });

  it('returns 501 for /api/midnight/sponsor, since there is no Midnight wallet to pay DUST fees with', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/midnight/sponsor',
      payload: { provenTx: 'aa' },
    });
    expect(res.statusCode).toBe(501);
  });

  it('returns 501 for /api/midnight/offers, since there is no DUST to sell', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/midnight/offers',
      payload: { quoteId: 'anything', offerCurrency: 'lovelace' },
    });
    expect(res.statusCode).toBe(501);
  });

  it('returns 501 for /api/midnight/ada/offers when ADA offers are also unconfigured', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/midnight/ada/offers',
      payload: {
        quoteId: 'anything',
        offerCurrency: 'midnight:shielded:lovelace',
        utxoTxHash: 'a'.repeat(64),
        senderAddress: 'addr_test1',
        expectedValue: '1',
      },
    });
    expect(res.statusCode).toBe(501);
  });

  it.each(['/api/offers', '/api/ada/offers', '/api/sponsor'])(
    'still serves the Midnight route at its old path %s',
    async (url) => {
      const res = await app.inject({ method: 'POST', url, payload: {} });
      expect(res.statusCode).not.toBe(404);
    },
  );
});
