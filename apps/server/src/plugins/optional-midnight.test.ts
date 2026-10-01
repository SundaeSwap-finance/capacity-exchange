import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import chainStatePlugin from './midnight/chain-state.js';
import txPlugin from './midnight/tx.js';
import walletUtxoPlugin from './midnight/wallet-utxo.js';
import cesWalletProviderPlugin from './ces-wallet-provider.js';
import metricsPlugin from './metrics.js';
import sponsorPlugin from './midnight/sponsor.js';
import offerPlugin from './midnight/offer.js';
import type { AppConfig } from '../loadConfig.js';

/**
 * No `midnight` field, same as when `MIDNIGHT_NETWORK` isn't set. Each plugin
 * should set its service to `null` and move on, not throw, so `buildApp()`
 * still boots (see `app.test.ts` for the full end-to-end check).
 */
const NO_MIDNIGHT_CONFIG: AppConfig = {
  port: 0,
  quoteTtlSeconds: 300,
  offerTtlSeconds: 2,
  priceFormulas: {},
  sponsorAll: false,
  sponsoredContracts: [],
  quoteSecretFile: '.quote-secret.plugin-test.key',
  capacityExchangeUrls: [],
};

describe('plugins decorate null instead of throwing when Midnight is not configured', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    app.decorate('config', NO_MIDNIGHT_CONFIG);
    await app.register(chainStatePlugin);
    await app.register(walletUtxoPlugin);
    await app.register(cesWalletProviderPlugin);
    await app.register(txPlugin);
    await app.register(metricsPlugin);
    await app.register(offerPlugin);
    await app.register(sponsorPlugin);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('chain-state: decorates midnightChainStateService as null', () => {
    expect(app.midnightChainStateService).toBeNull();
  });

  it('wallet-utxo: decorates both midnightWalletService and midnightUtxoService as null', () => {
    expect(app.midnightWalletService).toBeNull();
    expect(app.midnightUtxoService).toBeNull();
  });

  it('ces-wallet-provider: decorates cesWalletProvider as null', () => {
    expect(app.cesWalletProvider).toBeNull();
  });

  it('tx: decorates midnightTxService as null', () => {
    expect(app.midnightTxService).toBeNull();
  });

  it('metrics: reports no capacity', () => {
    expect(app.metricsService.getMetrics().capacity).toEqual([]);
  });

  it('offer: decorates midnightOfferService as null', () => {
    expect(app.midnightOfferService).toBeNull();
  });

  it('sponsor: decorates midnightSponsorService as null', () => {
    expect(app.midnightSponsorService).toBeNull();
  });
});
