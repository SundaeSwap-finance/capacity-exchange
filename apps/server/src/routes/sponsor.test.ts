import { describe, it, expect, vi } from 'vitest';
import { SponsorService } from '../services/sponsor.js';
import sponsorRoutes from './sponsor.js';
import { useRouteTestApp } from './test-utils.js';

describe('POST /api/sponsor - input validation', () => {
  const stub = Object.create(SponsorService.prototype) as SponsorService;
  stub.sponsorTx = vi.fn(async () => {
    throw new Error('should not be called');
  });

  const app = useRouteTestApp({
    decorations: { sponsorService: stub },
    routes: { plugin: sponsorRoutes, prefix: '/api' },
  });

  it('rejects empty provenTx', async () => {
    const res = await app.get().inject({
      method: 'POST',
      url: '/api/sponsor',
      payload: { provenTx: '' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects non-hex provenTx', async () => {
    const res = await app.get().inject({
      method: 'POST',
      url: '/api/sponsor',
      payload: { provenTx: 'not-hex-at-all!' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects provenTx with spaces', async () => {
    const res = await app.get().inject({
      method: 'POST',
      url: '/api/sponsor',
      payload: { provenTx: 'aa bb cc' },
    });
    expect(res.statusCode).toBe(400);
  });
});
