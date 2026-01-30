import type { ExchangeApi } from './exchangeApi';
import { ExchangePrice } from './types';

/**
 * Fetches prices from all capacity exchanges in parallel.
 * Returns combined prices from all successful responses.
 */
export async function fetchPricesFromExchanges(
  exchangeApis: ExchangeApi[],
  dustRequired: bigint
): Promise<ExchangePrice[]> {
  console.debug('[CapacityExchange] Fetching prices from', exchangeApis.length, 'exchanges');

  const priceResponses = await Promise.allSettled(
    exchangeApis.map(({ url, api }) =>
      api.apiPricesGet({ dust: dustRequired.toString() }).then((response) => ({ url, prices: response.prices }))
    )
  );

  const exchangePrices: ExchangePrice[] = [];
  for (let i = 0; i < priceResponses.length; i++) {
    const result = priceResponses[i];
    if (result.status === 'fulfilled') {
      const { url, prices } = result.value;
      const exchangeApi = exchangeApis[i];
      exchangePrices.push(...prices.map((price) => ({ exchangeApi, price })));
      console.debug('[CapacityExchange] Prices from', url, ':', prices);
    } else {
      console.warn('[CapacityExchange] Failed to fetch prices from an exchange:', result.reason);
    }
  }

  console.debug('[CapacityExchange] Total prices received:', exchangePrices.length);
  return exchangePrices;
}
