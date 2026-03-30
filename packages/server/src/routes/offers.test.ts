import { describe, it, expect, vi } from 'vitest';
import { OfferService } from '../services/offer.js';
import offerRoutes from './offers.js';
import { useRouteTestApp } from './test-utils.js';

describe('POST /api/offers - input validation', () => {
  const stub = Object.create(OfferService.prototype) as OfferService;
  stub.createOffer = vi.fn(async () => {
    throw new Error('should not be called');
  });

  const app = useRouteTestApp({
    decorations: { offerService: stub },
    routes: { plugin: offerRoutes, prefix: '/api' },
  });

  it('rejects specks of "0"', async () => {
    const res = await app.get().inject({
      method: 'POST',
      url: '/api/offers',
      payload: { specks: '0', offerCurrency: 'lovelace' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects negative specks', async () => {
    const res = await app.get().inject({
      method: 'POST',
      url: '/api/offers',
      payload: { specks: '-100', offerCurrency: 'lovelace' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects non-numeric specks', async () => {
    const res = await app.get().inject({
      method: 'POST',
      url: '/api/offers',
      payload: { specks: 'abc', offerCurrency: 'lovelace' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects empty specks', async () => {
    const res = await app.get().inject({
      method: 'POST',
      url: '/api/offers',
      payload: { specks: '', offerCurrency: 'lovelace' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects empty offerCurrency', async () => {
    const res = await app.get().inject({
      method: 'POST',
      url: '/api/offers',
      payload: { specks: '1000', offerCurrency: '' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects specks with leading zero', async () => {
    const res = await app.get().inject({
      method: 'POST',
      url: '/api/offers',
      payload: { specks: '01', offerCurrency: 'lovelace' },
    });
    expect(res.statusCode).toBe(400);
  });
});
