import { Configuration, DefaultApi } from '@sundaeswap/capacity-exchange-client';
import {
  OFFERS_PATH,
  OfferRejected,
  type OfferStatus,
  type Rejection,
  type SubmitOfferAccepted,
  type SubmitOfferRequest,
} from './protocol.js';

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

function base(url: string): string {
  return url.replace(/\/$/, '');
}

function apiFor(url: string): DefaultApi {
  return new DefaultApi(new Configuration({ basePath: base(url) }));
}

/** Asks one exchange what it would charge for `amount` lovelace of ADA capacity. */
export async function fetchPrices(url: string, amount: bigint): Promise<InstanceQuote> {
  const response = await apiFor(url).apiCardanoPricesGet({ amount: amount.toString() });
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

async function rejectionFrom(response: Response): Promise<OfferRejected> {
  const text = await response.text();
  try {
    const body = JSON.parse(text) as Partial<Rejection>;
    if (body.code) {
      return new OfferRejected(body.code, body.message ?? '');
    }
  } catch {
    // Not a CIP-0198 refusal; fall through and report it as received.
  }
  // A refusal without a recognised code is treated as `not-interested`, as CIP-0198 directs.
  return new OfferRejected('not-interested', `${response.status} ${text}`);
}

/**
 * Submits an offer. A `202` means accepted for verification and nothing more; a refusal from
 * the stateless checks comes back instead of it, carrying a CIP-0198 reason.
 */
export async function submitOffer(url: string, body: SubmitOfferRequest): Promise<SubmitOfferAccepted> {
  const response = await fetch(`${base(url)}${OFFERS_PATH}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (response.status !== 202) {
    throw await rejectionFrom(response);
  }
  return (await response.json()) as SubmitOfferAccepted;
}

/** The service's own view of an offer. Not authoritative about inclusion; the chain is. */
export async function getOfferStatus(url: string, offerId: string): Promise<OfferStatus> {
  const response = await fetch(`${base(url)}${OFFERS_PATH}/${offerId}`);
  if (!response.ok) {
    throw new Error(`Status request to ${url} failed: ${response.status} ${await response.text()}`);
  }
  return (await response.json()) as OfferStatus;
}

/** A price is only useful if the caller actually holds the currency it is denominated in. */
export function isPayableWith(price: Price, heldUnits: Set<string>): boolean {
  if (price.currency.type === 'cardano:native') {
    return heldUnits.has(price.currency.rawId);
  }
  return false;
}
