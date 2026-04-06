import { describe, it, expect } from 'vitest';
import { CLIENT, getQuoteId } from '../utils.js';

describe('Offer API - Insufficient Funds', () => {
  it('should return 409 when requesting too much', async () => {
    const { quoteId, currency } = await getQuoteId('999999999999999999999999999');
    const res = await CLIENT.createOffer({ quoteId, offerCurrency: currency });
    expect(res.status).toBe(409);
  });
});
