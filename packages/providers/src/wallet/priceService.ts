import type { CesApi } from './exchangeApi.js';
import { ExchangePrice } from './types.js';

/**
 * Fetches prices from all capacity exchanges in parallel, keeping only currencies this
 * wallet can actually pay in.
 *
 * An exchange may advertise a currency for a chain this dapp has no payer for. Offering it
 * would let the user pick something nothing can execute, and the failure would land AFTER
 * selection, which is the point the escrow commits. Filter here so an unpayable currency is
 * never shown, and the error at selection stays an invariant violation rather than a routine
 * outcome.
 */
export async function fetchPricesFromExchanges(
  exchangeApis: CesApi[],
  dustRequired: bigint,
  payableCurrencyTypes: ReadonlySet<string>
): Promise<ExchangePrice[]> {
  console.debug('[CapacityExchange] Fetching prices from', exchangeApis.length, 'exchange(s)');

  const priceResponses = await Promise.allSettled(
    exchangeApis.map(({ url, api }) =>
      api.apiPricesGet({ currency: 'DUST', amount: dustRequired.toString() }).then((response) => ({
        url,
        quoteId: response.quoteId,
        prices: response.prices,
      }))
    )
  );

  const exchangePrices: ExchangePrice[] = [];
  for (let i = 0; i < priceResponses.length; i++) {
    const result = priceResponses[i];
    if (result.status === 'fulfilled') {
      const { url, quoteId, prices } = result.value;
      const exchangeApi = exchangeApis[i];
      const payable = prices.filter((price) => payableCurrencyTypes.has(price.currency.type));
      exchangePrices.push(...payable.map((price) => ({ exchangeApi, quoteId, price })));
      console.debug('[CapacityExchange] Prices from', url, ':', prices);
    } else {
      console.warn('[CapacityExchange] Failed to fetch prices from an exchange:', result.reason);
    }
  }

  console.debug('[CapacityExchange] Total prices received:', exchangePrices.length);
  return exchangePrices;
}
