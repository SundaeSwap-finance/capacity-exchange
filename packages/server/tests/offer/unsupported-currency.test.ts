import { describe, it, expect } from 'vitest';
import { CLIENT } from '../utils.js';

describe('Offer API - Unsupported Currency', () => {
  it('returns 400 for unsupported currency', async () => {
    const res = await CLIENT.createOffer({ specks: '1', offerCurrency: 'XYZ' });
    expect(res.status).toBe(400);
    expect(res.data).toHaveProperty('error', 'Bad Request');
  });
});
