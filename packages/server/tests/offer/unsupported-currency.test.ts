import { describe, it, expect } from 'vitest';
import { CLIENT, getQuoteId } from '../utils.js';

describe('Offer API - Unsupported Currency', () => {
  it('returns 400 for unsupported currency', async () => {
    const { quoteId } = await getQuoteId('1000');
    const res = await CLIENT.createOffer({ quoteId, offerCurrency: 'XYZ' });
    expect(res.status).toBe(400);
    expect(res.data).toHaveProperty('error', 'Bad Request');
  });
});
