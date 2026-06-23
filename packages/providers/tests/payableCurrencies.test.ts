import { describe, it, expect } from 'vitest';
import { fetchPricesFromExchanges } from '../src/wallet/priceService.js';
import type { CesApi } from '../src/wallet/exchangeApi.js';

function exchangeOffering(types: string[]): CesApi {
  return {
    url: 'fake://exchange',
    api: {
      apiPricesGet: async () => ({
        quoteId: 'q1',
        prices: types.map((type) => ({
          amount: '1000',
          currency: { id: type, type, rawId: '' },
        })),
      }),
    },
  } as unknown as CesApi;
}

describe('only currencies this wallet can pay in are offered', () => {
  // An exchange may advertise a chain this dapp has no payer for. Offering it lets the user
  // pick something nothing can execute, and the failure lands after selection, which is the
  // point the escrow commits. It must never reach the user.
  it('drops a foreign currency with no registered payer', async () => {
    const prices = await fetchPricesFromExchanges(
      [exchangeOffering(['midnight:shielded', 'ethereum:'])],
      1n,
      new Set(['midnight:shielded', 'midnight:unshielded'])
    );
    expect(prices.map((p) => p.price.currency.type)).toEqual(['midnight:shielded']);
  });

  it('keeps a foreign currency once a payer is registered for it', async () => {
    const prices = await fetchPricesFromExchanges(
      [exchangeOffering(['midnight:shielded', 'cardano:'])],
      1n,
      new Set(['midnight:shielded', 'midnight:unshielded', 'cardano:'])
    );
    expect(prices.map((p) => p.price.currency.type).sort()).toEqual(['cardano:', 'midnight:shielded']);
  });
});
