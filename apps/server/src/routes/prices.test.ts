import { describe, it, expect } from 'vitest';
import { randomBytes } from 'crypto';
import priceRoutes from './prices.js';
import { PriceService } from '../services/price.js';
import { QuoteService } from '../services/quote.js';
import { useRouteTestApp } from './test-utils.js';

const quoteService = new QuoteService(10, randomBytes(32));

describe('GET /api/prices', () => {
  const app = useRouteTestApp({
    decorations: {
      priceService: new PriceService([
        {
          currency: {
            type: 'shielded',
            identifier: 'lovelace',
          },
          basePrice: '1000',
          rateNumerator: '1',
          rateDenominator: '1',
        },
      ]),
      quoteService,
    },
    routes: { plugin: priceRoutes, prefix: '/api' },
  });

  it('returns a quoteId with prices', async () => {
    const res = await app.get().inject({
      method: 'GET',
      url: '/api/prices?specks=1000',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.quoteId).toBeDefined();
    expect(body.prices).toHaveLength(1);
    expect(body.prices[0].currency).toBe('lovelace');
  });

  it('returns a quoteId that decodes to the correct specks and prices', async () => {
    const res = await app.get().inject({
      method: 'GET',
      url: '/api/prices?specks=5000',
    });
    const { quoteId } = res.json();
    const result = quoteService.getQuote(quoteId);

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') {
      return;
    }
    expect(result.quote.specks).toBe(5000n);
    expect(result.quote.prices[0].currency).toEqual({
      id: 'shielded:lovelace',
      type: 'shielded',
      identifier: 'lovelace',
    });
  });
});
