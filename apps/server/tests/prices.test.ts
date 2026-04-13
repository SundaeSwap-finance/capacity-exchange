import { describe, it, expect } from 'vitest';
import { CLIENT } from './utils.js';
import { PricesResponse } from './client.js';

describe('Prices API', () => {
  it('should return a list of prices with a quoteId', async () => {
    const res = await CLIENT.getPrices('1000');
    expect(res.status).toBe(200);

    const data = res.data as typeof PricesResponse.static;
    expect(data.quoteId).toBeDefined();
    expect(data.prices).toEqual([
      {
        currency: {
          id: 'midnight:shielded:1337133713371337133713371337133713371337133713371337133713371337',
          type: 'midnight:shielded',
          rawId: '1337133713371337133713371337133713371337133713371337133713371337',
        },
        amount: '112',
      },
    ]);
  });
});
