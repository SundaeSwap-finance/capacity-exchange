import { describe, it, expect } from 'vitest';
import { CLIENT } from './utils.js';
import { PricesResponse } from './client.js';

describe('Prices API', () => {
  it('should return a list of prices', async () => {
    const res = await CLIENT.getPrices('1000');
    expect(res.status).toBe(200);

    const prices = (res.data as typeof PricesResponse.static).prices;
    expect(prices.length).toBeGreaterThan(0);
    expect(prices[0].currency).toBe(
      'shielded:de987b69b4b5ca4f14bb77efc4afe8932de8b82426f4f75d503437058ab9d127',
    );
    expect(Number(prices[0].amount)).toBeGreaterThan(0);
  });
});
