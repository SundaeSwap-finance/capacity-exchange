import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import type { AppConfig } from './loadConfig.js';

/**
 * A server config with every Midnight-side field absent — no `networkId`,
 * `endpoints`, `walletConnection`, or `walletStateStore` — the shape `loadConfig()`
 * now produces when `MIDNIGHT_NETWORK` isn't set and only `ADA` is priced. This
 * builds the *real* app (no mocks) to prove the whole plugin chain tolerates it,
 * not just the pieces this branch touched directly.
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
    expect(res.json()).toEqual({
      status: 'ok',
      wallet: { status: 'disabled' },
      indexer: { status: 'disabled' },
    });
  });

  it('reports null Midnight endpoints from the root endpoint', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.env).toEqual({
      network: null,
      node_url: null,
      node_ws_url: null,
      indexer_url: null,
      indexer_ws_url: null,
      proof_server_url: null,
    });
  });

  it('serves metrics with a disabled wallet and zeroed DUST usage', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/metrics' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.server.network).toBeNull();
    expect(body.health.wallet).toEqual({ status: 'disabled' });
    expect(body.dustUsage).toEqual({
      availableBalance: '0',
      totalSpecksConsumed: '0',
      specksLastHour: '0',
      locksLastHour: 0,
    });
  });

  it('still prices the capacity asset it actually sells (ADA)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/prices?currency=ADA&amount=1000000' });
    expect(res.statusCode).toBe(200);
    expect(res.json().prices).toBeInstanceOf(Array);
  });

  it('returns 501 for /api/sponsor, since there is no Midnight wallet to pay DUST fees with', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/sponsor',
      payload: { provenTx: 'aa' },
    });
    expect(res.statusCode).toBe(501);
  });

  it('returns 501 for /api/offers, since there is no DUST to sell', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/offers',
      payload: { quoteId: 'anything', offerCurrency: 'lovelace' },
    });
    expect(res.statusCode).toBe(501);
  });

  it('returns 501 for /api/ada/offers when ADA offers are also unconfigured', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/ada/offers',
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
});
