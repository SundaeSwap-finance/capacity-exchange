import { describe, it, expect } from 'vitest';
import hintRoutes from './hints.js';
import { useRouteTestApp } from '../test-utils.js';

describe('GET /api/cardano/hints', () => {
  const app = useRouteTestApp({
    decorations: { cardanoHintService: { hints: () => ['82a0', '82a1'] } },
    routes: { plugin: hintRoutes, prefix: '/api/cardano' },
  });

  it('serves the hint sets as a JSON array of hex', async () => {
    const res = await app.get().inject({ method: 'GET', url: '/api/cardano/hints' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(['82a0', '82a1']);
  });
});

describe('GET /api/cardano/hints without hints configured', () => {
  const app = useRouteTestApp({
    decorations: { cardanoHintService: null },
    routes: { plugin: hintRoutes, prefix: '/api/cardano' },
  });

  it('answers 501', async () => {
    const res = await app.get().inject({ method: 'GET', url: '/api/cardano/hints' });
    expect(res.statusCode).toBe(501);
  });
});
