import { describe, it, expect, afterEach } from 'vitest';
import { CLIENT, DEFAULT_REQUEST, waitForLocksToRelease } from '../utils.js';
import { CreateOfferResponse } from '../client.js';

describe('Offer API - Concurrency', () => {
  afterEach(async () => {
    await waitForLocksToRelease();
  });

  it('handles parallel requests', async () => {
    const CONCURRENT_REQUESTS = 5;

    const promises = Array(CONCURRENT_REQUESTS)
      .fill(null)
      .map(() => CLIENT.createOffer(DEFAULT_REQUEST));

    const responses = await Promise.all(promises);

    // Ensure all successful requests
    const successes = responses.filter((r) => r.status === 201);
    expect(successes.length).toBe(CONCURRENT_REQUESTS);

    // Check unique ids
    const ids = successes.map((r) => (r.data as typeof CreateOfferResponse.static).offerId);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });

  it('eventually exhausts wallet UTxOs', async () => {
    let count = 0;
    const MAX_ATTEMPTS = 100;
    let exhaustedUtxos = false;

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const res = await CLIENT.createOffer({
        ...DEFAULT_REQUEST,
        specks: '1', // Use minimal specks to test UTxO count
      });

      if (res.status === 201) {
        count++;
      } else if (res.status === 409) {
        exhaustedUtxos = true;
        break;
      } else {
        throw new Error(`Unexpected status ${res.status}: ${JSON.stringify(res.data)}`);
      }
    }

    expect(exhaustedUtxos).toBe(true);
  });
});
