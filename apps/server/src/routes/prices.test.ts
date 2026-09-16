import { describe, it, expect } from 'vitest';
import { randomBytes } from 'crypto';
import priceRoutes from './prices.js';
import { PriceService } from '../services/price.js';
import { QuoteService } from '../services/quote.js';
import { useRouteTestApp } from './test-utils.js';

const quoteService = new QuoteService(10, randomBytes(32));

const priceService = new PriceService({
  DUST: [
    {
      currency: { type: 'midnight:shielded', rawId: 'lovelace' },
      basePrice: '1000',
      rateNumerator: '1',
      rateDenominator: '1',
    },
  ],
  ADA: [
    {
      currency: { type: 'cardano', rawId: 'deadbeef' },
      basePrice: '500',
      rateNumerator: '2',
      rateDenominator: '1',
    },
  ],
});

describe('GET /api/prices', () => {
  const app = useRouteTestApp({
    decorations: { priceService, quoteService },
    routes: { plugin: priceRoutes, prefix: '/api' },
  });

  it('returns a quoteId with prices', async () => {
    const res = await app.get().inject({
      method: 'GET',
      url: '/api/prices?currency=DUST&amount=1000',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.quoteId).toBeDefined();
    expect(body.prices).toHaveLength(1);
    expect(body.prices[0].currency).toEqual({
      id: 'midnight:shielded:lovelace',
      type: 'midnight:shielded',
      rawId: 'lovelace',
    });
  });

  it('returns a quoteId that decodes to the correct specks and prices', async () => {
    const res = await app.get().inject({
      method: 'GET',
      url: '/api/prices?currency=DUST&amount=5000',
    });
    const { quoteId } = res.json();
    const result = quoteService.getQuote(quoteId);

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') {
      return;
    }
    expect(result.quote.currency).toBe('DUST');
    expect(result.quote.amount).toBe(5000n);
    expect(result.quote.prices[0].currency).toEqual({
      id: 'midnight:shielded:lovelace',
      type: 'midnight:shielded',
      rawId: 'lovelace',
    });
  });

  it('prices ADA capacity from its own formulas, not DUST rates', async () => {
    const res = await app.get().inject({
      method: 'GET',
      url: '/api/prices?currency=ADA&amount=1000',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    // 500 + 1000 * 2/1 = 2500, whereas the DUST formula would give 2000.
    expect(body.prices).toEqual([
      { amount: '2500', currency: { id: 'cardano:deadbeef', type: 'cardano', rawId: 'deadbeef' } },
    ]);
  });

  it('stamps the requested asset into the quote', async () => {
    const res = await app.get().inject({
      method: 'GET',
      url: '/api/prices?currency=ADA&amount=1000',
    });
    const result = quoteService.getQuote(res.json().quoteId);
    expect(result.status === 'ok' && result.quote.currency).toBe('ADA');
  });

  it('rejects an unknown capacity asset at the schema', async () => {
    const res = await app.get().inject({
      method: 'GET',
      url: '/api/prices?currency=BTC&amount=1000',
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /api/prices on a server that does not sell ADA', () => {
  const app = useRouteTestApp({
    decorations: {
      priceService: new PriceService({
        DUST: [
          {
            currency: { type: 'midnight:shielded', rawId: 'lovelace' },
            basePrice: '1000',
            rateNumerator: '1',
            rateDenominator: '1',
          },
        ],
      }),
      quoteService,
    },
    routes: { plugin: priceRoutes, prefix: '/api' },
  });

  it('400s rather than quoting DUST prices for an ADA request', async () => {
    const res = await app.get().inject({
      method: 'GET',
      url: '/api/prices?currency=ADA&amount=1000',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain('does not sell ADA');
  });
});
