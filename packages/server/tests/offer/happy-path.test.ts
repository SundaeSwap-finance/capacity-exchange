import { describe, it, expect } from 'vitest';
import { CLIENT, DEFAULT_REQUEST } from '../utils.js';
import { CreateOfferResponse } from '../client.js';

// TODO: Add a test case for the minimal amount of DUST requested, that an offer price is >0
describe('Offer API - Happy Path', () => {
  it('creates an offer successfully', async () => {
    const res = await CLIENT.createOffer(DEFAULT_REQUEST);
    expect(res.status).toBe(201);

    const offer = res.data as typeof CreateOfferResponse.static;
    expect(offer.offerId).toBeDefined();
    expect(offer.offerAmount).toBeDefined();
    expect(offer.offerCurrency).toBeDefined();
    expect(offer.serializedTx).toBeDefined();
    expect(offer.expiresAt).toBeDefined();
  });
});
