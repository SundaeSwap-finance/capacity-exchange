import { describe, it, expect } from 'vitest';
import { CLIENT } from '../utils.js';

describe('Offer API - Insufficient Funds', () => {
  it('should return 409 when requesting too much', async () => {
    const request = {
      specks: '1000000000000000',
      offerCurrency: 'lovelace',
    };

    const res = await CLIENT.createOffer(request);
    expect(res.status).toBe(409);
  });
});
