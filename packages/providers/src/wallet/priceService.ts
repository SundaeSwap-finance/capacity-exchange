import type { CesApi } from './exchangeApi';
import { ExchangePrice } from './types';

/**
 * Fetches prices from all capacity exchanges in parallel.
 * Returns combined prices from all successful responses.
 */
export async function fetchPricesFromExchanges(exchangeApis: CesApi[], dustRequired: bigint): Promise<ExchangePrice[]> {
  console.debug('[CapacityExchange] Fetching prices from', exchangeApis.length, 'exchange(s)');

  const priceResponses = await Promise.allSettled(
    exchangeApis.map(({ url, api }) =>
      api
        .apiPricesGet({ specks: dustRequired.toString() })
        .then((response) => ({ url, quoteId: response.quoteId, prices: response.prices }))
    )
  );

  const exchangePrices: ExchangePrice[] = [];
  for (let i = 0; i < priceResponses.length; i++) {
    const result = priceResponses[i];
    if (result.status === 'fulfilled') {
      const { url, quoteId, prices } = result.value;
      const exchangeApi = exchangeApis[i];
      exchangePrices.push(...prices.map((price) => ({ exchangeApi, quoteId, price })));
      console.debug('[CapacityExchange] Prices from', url, ':', prices);
    } else {
      console.warn('[CapacityExchange] Failed to fetch prices from an exchange:', result.reason);
    }
  }

  console.debug('[CapacityExchange] Total prices received:', exchangePrices.length);
  return exchangePrices;
}
