import { describe, it, expect, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import healthRoutes from './health.js';
import type { AppConfig } from '../loadConfig.js';
import type { CardanoChainStateService } from '../services/cardano-chain-state.js';

/** A server with no Midnight network, so readiness depends on Cardano alone. */
const CONFIG = { capacityExchangeUrls: [] } as unknown as AppConfig;

async function appWithCardano(health: ReturnType<CardanoChainStateService['health']> | null) {
  const app = Fastify({ logger: false });
  app.decorate('config', CONFIG);
  app.decorate('walletService', null);
  app.decorate(
    'cardanoChainStateService',
    health ? ({ health: () => health } as unknown as CardanoChainStateService) : null,
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
  });

  it('reports Cardano as disabled when no UTxO RPC source is configured', async () => {
    app = await appWithCardano(null);
    const res = await app.inject({ method: 'GET', url: '/health/ready' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      status: 'ok',
      midnight: { wallet: { status: 'disabled' }, indexer: { status: 'disabled' } },
      cardano: { status: 'disabled' },
    });
  });

  it('is ready while the Cardano tip is fresh', async () => {
    app = await appWithCardano({ status: 'ok', slot: 2118000, tipAgeMs: 4000 });
    const res = await app.inject({ method: 'GET', url: '/health/ready' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      status: 'ok',
      cardano: { status: 'ok', slot: 2118000, tipAgeMs: 4000 },
    });
  });

  it('is a 503 while the Cardano tip is stale', async () => {
    app = await appWithCardano({ status: 'syncing', slot: 2000000, tipAgeMs: 600_000 });
    const res = await app.inject({ method: 'GET', url: '/health/ready' });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ status: 'syncing', cardano: { status: 'syncing' } });
  });

  it('is a 500 when the Cardano stream is down', async () => {
    app = await appWithCardano({ status: 'ko', error: 'connection refused' });
    const res = await app.inject({ method: 'GET', url: '/health/ready' });

    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({
      status: 'ko',
      cardano: { status: 'ko', error: 'connection refused' },
    });
  });
});
