import { DefaultApi, Configuration } from '@sundaeswap/capacity-exchange-client';
import { vi } from 'vitest';

export function createMockCapacityExchangeAPI() {
  const mockApi = {
    apiPricesGet: vi.fn().mockResolvedValue({
      prices: [
        { currency: 'ADA', amount: '1000000' },
        { currency: 'BTC', amount: '50000' },
      ],
    }),

    apiOffersPost: vi.fn().mockResolvedValue({
      offerId: 'test-offer-123',
      offerAmount: '1000000',
      offerCurrency: 'ADA',
      serializedTx: '0102030405',
      expiresAt: new Date(Date.now() + 60000),
    }),
  };

  return mockApi as unknown as DefaultApi;
}

export function createMockConfiguration(basePath: string = 'http://localhost:3000'): Configuration {
  return new Configuration({ basePath });
}
