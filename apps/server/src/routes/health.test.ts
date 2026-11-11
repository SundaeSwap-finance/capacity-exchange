import { describe, it, expect, afterEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import healthRoutes from './health.js';
import type { AppConfig } from '../loadConfig.js';
import type { CardanoChainStateService } from '../services/cardano/chain-state.js';
import type { CardanoWalletService } from '../services/cardano/wallet.js';
import type { MidnightWalletService, WalletSyncState } from '../services/midnight/wallet.js';
import type { MidnightChainStateService } from '../services/midnight/chain-state.js';

type CardanoHealth = ReturnType<CardanoChainStateService['health']>;

const INDEXER_URL = 'http://indexer.test/graphql';

/** Answers the readiness check's indexer query with a block height. */
function stubIndexer() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => ({ data: { block: { height: 42 } } }) })),
  );
}

async function appWith({
  wallet,
  cardano,
  cardanoLovelace,
  chainState = { status: 'ok' },
}: {
  chainState?: { status: 'ok' } | { status: 'syncing'; error?: string };
  wallet?: WalletSyncState;
  cardano?: CardanoHealth;
  cardanoLovelace?: bigint;
}) {
  const app = Fastify({ logger: false });
  const midnight = wallet ? { endpoints: { indexerHttpUrl: INDEXER_URL } } : undefined;
  app.decorate('config', { midnight, capacityExchangeUrls: [] } as unknown as AppConfig);
  app.decorate(
    'midnightWalletService',
    wallet ? ({ syncState: wallet } as unknown as MidnightWalletService) : null,
  );
  app.decorate(
    'midnightChainStateService',
    wallet ? ({ health: () => chainState } as unknown as MidnightChainStateService) : null,
  );
  app.decorate(
    'cardanoChainStateService',
    cardano ? ({ health: () => cardano } as unknown as CardanoChainStateService) : null,
  );
  app.decorate(
    'cardanoWalletService',
    cardanoLovelace === undefined
      ? null
      : ({ lovelace: () => cardanoLovelace } as unknown as CardanoWalletService),
  );
  await app.register(healthRoutes, { prefix: '/health' });
  await app.ready();
  return app;
}

describe('GET /health/ready', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
    vi.unstubAllGlobals();
  });

  const ready = () => app!.inject({ method: 'GET', url: '/health/ready' });

  it('leaves out chains that are not configured', async () => {
    app = await appWith({});
    const res = await ready();

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('reports the Cardano tip', async () => {
    app = await appWith({ cardano: { status: 'ok', slot: 2118000, tipAgeMs: 4000 } });
    const res = await ready();

    expect(res.statusCode).toBe(200);
    expect(res.json().cardano).toEqual({ status: 'ok', slot: 2118000, tipAgeMs: 4000 });
  });

  it("reports the Cardano wallet's ADA in lovelace", async () => {
    app = await appWith({
      cardano: { status: 'ok', slot: 2118000, tipAgeMs: 4000 },
      cardanoLovelace: 12_345_678_901_234_567_890n,
    });
    const res = await ready();

    expect(res.statusCode).toBe(200);
    expect(res.json().cardano).toEqual({
      status: 'ok',
      slot: 2118000,
      tipAgeMs: 4000,
      walletLovelace: '12345678901234567890',
    });
  });

  it('stays ready while the Cardano stream is down', async () => {
    stubIndexer();
    app = await appWith({
      wallet: { status: 'ok' },
      cardano: { status: 'ko', error: 'connection refused' },
    });
    const res = await ready();

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      status: 'ok',
      midnight: { wallet: { status: 'ok' }, indexer: { status: 'ok', height: 42 } },
      cardano: { status: 'ko', error: 'connection refused' },
    });
  });

  it('stays ready while the Cardano tip is stale', async () => {
    app = await appWith({ cardano: { status: 'syncing', slot: 2000000, tipAgeMs: 600_000 } });
    const res = await ready();

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok', cardano: { status: 'syncing' } });
  });

  it('is a 503 while the Midnight wallet syncs, whatever the Cardano state', async () => {
    stubIndexer();
    app = await appWith({
      wallet: { status: 'syncing' },
      cardano: { status: 'ok', slot: 2118000, tipAgeMs: 4000 },
    });
    const res = await ready();

    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({
      status: 'syncing',
      midnight: { wallet: { status: 'syncing' } },
    });
  });

  it('is a 503 until the Midnight chain state has loaded from the indexer', async () => {
    stubIndexer();
    app = await appWith({
      wallet: { status: 'ok' },
      chainState: { status: 'syncing', error: 'tip: Indexer returned HTTP 500' },
    });
    const res = await ready();

    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({
      status: 'syncing',
      midnight: { chainState: { status: 'syncing', error: 'tip: Indexer returned HTTP 500' } },
    });
  });

  it('is a 503 when the indexer is unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('connect ECONNREFUSED'))),
    );
    app = await appWith({ wallet: { status: 'ok' } });
    const res = await ready();

    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({
      status: 'ko',
      midnight: { indexer: { status: 'ko', error: 'Unreachable: connect ECONNREFUSED' } },
    });
  });

  it('is a 503 when the indexer returns a 500', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 500, statusText: 'Internal Server Error' })),
    );
    app = await appWith({ wallet: { status: 'ok' } });
    const res = await ready();

    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ status: 'ko', midnight: { indexer: { status: 'ko' } } });
  });

  it('is a 500 when the Midnight wallet fails', async () => {
    stubIndexer();
    app = await appWith({ wallet: { status: 'ko', error: 'sync failed' } });
    const res = await ready();

    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({ status: 'ko', midnight: { wallet: { status: 'ko' } } });
    expect(res.json()).not.toHaveProperty('cardano');
  });
});
