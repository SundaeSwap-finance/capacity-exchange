import { describe, it, expect, vi } from 'vitest';
import { MidnightSponsorService } from '../../services/midnight/sponsor.js';
import sponsorRoutes from './sponsor.js';
import { useRouteTestApp } from '../test-utils.js';

describe('POST /api/midnight/sponsor - input validation', () => {
  const stub = Object.create(MidnightSponsorService.prototype) as MidnightSponsorService;
  stub.sponsorTx = vi.fn(async () => {
    throw new Error('should not be called');
  });

  const app = useRouteTestApp({
    decorations: { midnightSponsorService: stub },
    routes: { plugin: sponsorRoutes, prefix: '/api/midnight' },
  });

  it('rejects empty provenTx', async () => {
    const res = await app.get().inject({
      method: 'POST',
      url: '/api/midnight/sponsor',
      payload: { provenTx: '' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects non-hex provenTx', async () => {
    const res = await app.get().inject({
      method: 'POST',
      url: '/api/midnight/sponsor',
      payload: { provenTx: 'not-hex-at-all!' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects provenTx with spaces', async () => {
    const res = await app.get().inject({
      method: 'POST',
      url: '/api/midnight/sponsor',
      payload: { provenTx: 'aa bb cc' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /api/midnight/sponsor - without midnightSponsorService configured', () => {
  const app = useRouteTestApp({
    decorations: { midnightSponsorService: null },
    routes: { plugin: sponsorRoutes, prefix: '/api/midnight' },
  });

  it('returns 501 when Midnight is not configured on this server', async () => {
    const res = await app.get().inject({
      method: 'POST',
      url: '/api/midnight/sponsor',
      payload: { provenTx: 'aa' },
    });
    expect(res.statusCode).toBe(501);
  });
});
