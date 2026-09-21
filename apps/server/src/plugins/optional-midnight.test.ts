import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import chainStatePlugin from './chain-state.js';
import txPlugin from './tx.js';
import walletUtxoPlugin from './wallet-utxo.js';
import cesWalletProviderPlugin from './ces-wallet-provider.js';
import metricsPlugin from './metrics.js';
import sponsorPlugin from './sponsor.js';
import offerPlugin from './offer.js';
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

  it('chain-state: decorates chainStateService as null', () => {
    expect(app.chainStateService).toBeNull();
  });

  it('wallet-utxo: decorates both walletService and utxoService as null', () => {
    expect(app.walletService).toBeNull();
    expect(app.utxoService).toBeNull();
  });

  it('ces-wallet-provider: decorates cesWalletProvider as null', () => {
    expect(app.cesWalletProvider).toBeNull();
  });

  it('tx: decorates txService as null', () => {
    expect(app.txService).toBeNull();
  });

  it('metrics: decorates metricsService as null', () => {
    expect(app.metricsService).toBeNull();
  });

  it('offer: decorates offerService as null', () => {
    expect(app.offerService).toBeNull();
  });

  it('sponsor: decorates sponsorService as null', () => {
    expect(app.sponsorService).toBeNull();
  });
});
