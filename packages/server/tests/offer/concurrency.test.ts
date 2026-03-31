import { describe, it, expect, afterEach } from 'vitest';
import { CLIENT, getQuoteId, waitForLocksToRelease } from '../utils.js';
import { CreateOfferResponse } from '../client.js';

describe('Offer API - Concurrency', () => {
  afterEach(async () => {
    await waitForLocksToRelease();
  });

  it('coalesces parallel requests with the same quoteId', async () => {
    const { quoteId, currency } = await getQuoteId('1000');
    const CONCURRENT_REQUESTS = 5;

    const promises = Array(CONCURRENT_REQUESTS)
      .fill(null)
      .map(() => CLIENT.createOffer({ quoteId, offerCurrency: currency }));

    const responses = await Promise.all(promises);

    const successes = responses.filter((r) => r.status === 201);
    expect(successes.length).toBe(CONCURRENT_REQUESTS);

    // All should return the same offer
    const ids = successes.map((r) => (r.data as typeof CreateOfferResponse.static).offerId);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(1);
  });

  it('handles parallel requests with different quoteIds', async () => {
    const CONCURRENT_REQUESTS = 3;

    const quotes = await Promise.all(
      Array(CONCURRENT_REQUESTS)
        .fill(null)
        .map(() => getQuoteId('1000')),
    );

    const promises = quotes.map(({ quoteId, currency }) =>
      CLIENT.createOffer({ quoteId, offerCurrency: currency }),
    );

    const responses = await Promise.all(promises);

    const successes = responses.filter((r) => r.status === 201);
    expect(successes.length).toBe(CONCURRENT_REQUESTS);

    // Different quoteIds should produce different offers
    const ids = successes.map((r) => (r.data as typeof CreateOfferResponse.static).offerId);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(CONCURRENT_REQUESTS);
  });

  it('eventually exhausts wallet UTxOs', async () => {
    const CONCURRENT_REQUESTS = 20;
    let exhaustedUtxos = false;

    const quotes = await Promise.all(
      Array(CONCURRENT_REQUESTS)
        .fill(null)
        .map((_, i) => getQuoteId(i.toString())),
    );

    const promises = quotes.map(({ quoteId, currency }) =>
      CLIENT.createOffer({ quoteId, offerCurrency: currency }),
    );

    const results = await Promise.allSettled(promises);
    for (const result of results) {
      if (result.status === "rejected") {
        continue;
      }
      if (result.value.status === 409) {
        exhaustedUtxos = true;
        break;
      }
    }

    expect(exhaustedUtxos).toBe(true);
  });
});
