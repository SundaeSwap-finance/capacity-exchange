import { describe, it, expect } from 'vitest';
import { CLIENT } from './utils.js';
import { PricesResponse } from './client.js';

describe('Prices API', () => {
  it('should return a list of prices', async () => {
    const res = await CLIENT.getPrices('1000');
    expect(res.status).toBe(200);

    const prices = (res.data as typeof PricesResponse.static).prices;
    expect(prices.length).toBeGreaterThan(0);
    expect(prices[0].currency).toBe('lovelace');
    expect(Number(prices[0].amount)).toBeGreaterThan(0);
  });
});
