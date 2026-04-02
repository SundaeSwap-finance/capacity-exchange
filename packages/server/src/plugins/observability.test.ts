import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import observability from './observability.js';

const mockAdd = vi.fn();
const mockRecord = vi.fn();
vi.mock('../meter.js', () => ({
  meterService: {
    getMeter: () => ({
      createCounter: () => ({ add: mockAdd }),
      createHistogram: () => ({ record: mockRecord }),
    }),
  },
}));

describe('observability plugin', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(observability);
    app.get('/test', async () => ({ ok: true }));
    app.get('/error', async (_req, reply) => reply.status(500).send({ error: 'boom' }));
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('records a 200 response', async () => {
    mockAdd.mockClear();
    mockRecord.mockClear();
    await app.inject({ method: 'GET', url: '/test' });

    expect(mockAdd).toHaveBeenCalledWith(1, { status: '200', route: '/test' });
    expect(mockRecord).toHaveBeenCalledWith(expect.any(Number), { status: '200', route: '/test' });
  });

  it('records a 500 response', async () => {
    mockAdd.mockClear();
    mockRecord.mockClear();
    await app.inject({ method: 'GET', url: '/error' });

    expect(mockAdd).toHaveBeenCalledWith(1, { status: '500', route: '/error' });
    expect(mockRecord).toHaveBeenCalledWith(expect.any(Number), { status: '500', route: '/error' });
  });

  it('records unknown route as "unknown"', async () => {
    mockAdd.mockClear();
    mockRecord.mockClear();
    await app.inject({ method: 'GET', url: '/nonexistent' });

    expect(mockAdd).toHaveBeenCalledWith(1, { status: '404', route: 'unknown' });
  });
});
