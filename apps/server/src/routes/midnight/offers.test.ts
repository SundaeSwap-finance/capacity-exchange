import { describe, it, expect, vi } from 'vitest';
import { randomBytes } from 'crypto';
import offerRoutes from './offers.js';
import { MidnightOfferService } from '../../services/midnight/offer.js';
import { QuoteService } from '../../services/quote.js';
import { useRouteTestApp } from '../test-utils.js';

const quoteService = new QuoteService(10, randomBytes(32));

const stub = Object.create(MidnightOfferService.prototype) as MidnightOfferService;
stub.createOffer = vi.fn(async (req) => ({
  status: 'ok' as const,
  source: 'built' as const,
  offer: {
    offerId: 'test-id',
    offerAmount: '1000',
    offerCurrency: {
      id: req.offerCurrency,
      type: 'midnight:shielded' as const,
      rawId: req.offerCurrency.substring('midnight:shielded:').length,
    },
    serializedTx: 'deadbeef',
    expiresAt: new Date().toISOString(),
  },
  specksCommitted: 1000n,
  revenueCommitted: { amount: 100n, currency: req.offerCurrency },
}));

describe('POST /api/midnight/offers', () => {
  const app = useRouteTestApp({
    decorations: { midnightOfferService: stub, quoteService },
    routes: { plugin: offerRoutes, prefix: '/api/midnight' },
  });

  it('returns 201 with a valid quote', async () => {
    const quoteId = quoteService.createQuote('DUST', 1000n, [
      {
        amount: '100',
        currency: {
          id: 'midnight:shielded:lovelace',
          type: 'midnight:shielded',
          rawId: 'lovelace',
        },
      },
    ]);
    const res = await app.get().inject({
      method: 'POST',
      url: '/api/midnight/offers',
      payload: { quoteId, offerCurrency: 'lovelace' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().offerId).toBe('test-id');
  });

  it('returns 400 for invalid quoteId', async () => {
    const res = await app.get().inject({
      method: 'POST',
      url: '/api/midnight/offers',
      payload: { quoteId: 'garbage', offerCurrency: 'lovelace' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects empty quoteId', async () => {
    const res = await app.get().inject({
      method: 'POST',
      url: '/api/midnight/offers',
      payload: { quoteId: '', offerCurrency: 'lovelace' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects empty offerCurrency', async () => {
    const quoteId = quoteService.createQuote('DUST', 1000n, []);
    const res = await app.get().inject({
      method: 'POST',
      url: '/api/midnight/offers',
      payload: { quoteId, offerCurrency: '' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 410 for expired quoteId', async () => {
    const quoteId = quoteService.createQuote('DUST', 1000n, []);
    const realDateNow = Date.now;
    Date.now = () => realDateNow() + 11_000;
    try {
      const res = await app.get().inject({
        method: 'POST',
        url: '/api/midnight/offers',
        payload: { quoteId, offerCurrency: 'lovelace' },
      });
      expect(res.statusCode).toBe(410);
    } finally {
      Date.now = realDateNow;
    }
  });
});

describe('POST /api/midnight/offers - without midnightOfferService configured', () => {
  const app = useRouteTestApp({
    decorations: { midnightOfferService: null },
    routes: { plugin: offerRoutes, prefix: '/api/midnight' },
  });

  it('returns 501 when Midnight is not configured on this server', async () => {
    const res = await app.get().inject({
      method: 'POST',
      url: '/api/midnight/offers',
      payload: { quoteId: 'anything', offerCurrency: 'lovelace' },
    });
    expect(res.statusCode).toBe(501);
  });
});
