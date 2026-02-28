import { describe, it, expect } from 'vitest';
import { CLIENT } from '../utils.js';

describe('Offer API - Insufficient Funds', () => {
  it('should return 409 when requesting too much', async () => {
    const request = {
      specks: '1000000000000000',
      offerCurrency: 'shielded:de987b69b4b5ca4f14bb77efc4afe8932de8b82426f4f75d503437058ab9d127',
    };

    const res = await CLIENT.createOffer(request);
    expect(res.status).toBe(409);
  });
});
