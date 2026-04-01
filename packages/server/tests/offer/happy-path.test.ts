import { describe, it, expect } from 'vitest';
import { CLIENT, getQuoteId } from '../utils.js';
import { CreateOfferResponse } from '../client.js';
import { PreBinding, Proof, SignatureEnabled, Transaction } from '@midnight-ntwrk/ledger-v8';
import { hexToBytes } from '@capacity-exchange/midnight-core';

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

    // check that response is valid
    const bytes = hexToBytes(offer.serializedTx);
    expect(() => Transaction.deserialize<SignatureEnabled, Proof, PreBinding>('signature', 'proof', 'pre-binding', bytes)).not.toThrow();
  });
});
