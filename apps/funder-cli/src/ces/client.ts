import { ApiPricesGetCurrencyEnum, Configuration, DefaultApi } from '@sundaeswap/capacity-exchange-client';

export interface Currency {
  id: string;
  type: string;
  rawId: string;
}

export interface Price {
  amount: string;
  currency: Currency;
}

/** One instance's answer to a price request. */
export interface InstanceQuote {
  url: string;
  quoteId: string;
  prices: Price[];
}

export interface QuoteFailure {
  url: string;
  message: string;
}

function apiFor(url: string): DefaultApi {
  return new DefaultApi(new Configuration({ basePath: url.replace(/\/$/, '') }));
}

/** Asks one exchange what it would charge for `amount` lovelace of ADA capacity. */
export async function fetchPrices(url: string, amount: bigint): Promise<InstanceQuote> {
  const response = await apiFor(url).apiPricesGet({
    amount: amount.toString(),
    currency: ApiPricesGetCurrencyEnum.Ada,
  });
  return {
    url,
    quoteId: response.quoteId,
    prices: (response.prices ?? []) as unknown as Price[],
  };
}

/** Fans out to every configured instance; a failing instance is reported, not fatal. */
export async function fetchAllPrices(
  urls: string[],
  amount: bigint
): Promise<{ quotes: InstanceQuote[]; failures: QuoteFailure[] }> {
  const settled = await Promise.allSettled(urls.map((url) => fetchPrices(url, amount)));
  const quotes: InstanceQuote[] = [];
  const failures: QuoteFailure[] = [];
  settled.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      quotes.push(result.value);
    } else {
      failures.push({ url: urls[i], message: String(result.reason?.message ?? result.reason) });
    }
  });
  return { quotes, failures };
}

/** The offer payload, shaped exactly like the server's CreateOfferResponse. */
export interface OfferResponse {
  offerId: string;
  offerAmount: string;
  offerCurrency: Currency;
  /** Hex-encoded `[sub_transaction_body, witness_set, auxiliary_data/nil]`. */
  serializedTx: string;
  expiresAt: string;
}

/**
 * Requests an offer from a real exchange. The ADA-capacity offer route does not exist on the
 * server yet, which is why `--simulate-ces` exists; this is the path it will replace.
 */
export async function requestOffer(
  url: string,
  body: { quoteId: string; offerCurrency: string }
): Promise<OfferResponse> {
  const response = await fetch(`${url.replace(/\/$/, '')}/api/ada/capacity/offers`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Offer request to ${url} failed: ${response.status} ${await response.text()}`);
  }
  return (await response.json()) as OfferResponse;
}

/** A price is only useful if the caller actually holds the currency it is denominated in. */
export function isPayableWith(price: Price, heldUnits: Set<string>): boolean {
  if (price.currency.type === 'cardano:native') {
    return heldUnits.has(price.currency.rawId);
  }
  return false;
}
