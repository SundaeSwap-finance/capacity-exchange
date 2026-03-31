import { describe, it, expect } from 'vitest';
import { CLIENT, getQuoteId } from '../utils.js';
import { CreateOfferResponse } from '../client.js';

describe('Offer API - Happy Path', () => {
  it('creates an offer successfully', async () => {
    const { quoteId, currency } = await getQuoteId('1000');
    const res = await CLIENT.createOffer({ quoteId, offerCurrency: currency });
    expect(res.status).toBe(201);

    const offer = res.data as typeof CreateOfferResponse.static;
    expect(offer.offerId).toBeDefined();
    expect(offer.offerAmount).toBeDefined();
    expect(offer.offerCurrency).toBeDefined();
    expect(offer.serializedTx).toBeDefined();
    expect(offer.expiresAt).toBeDefined();
  });
});
