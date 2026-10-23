import { describe, it, expect } from 'vitest';
import { serializeEnvelope, SubTransaction } from '@capacity-exchange/cardano-core';
import { CLIENT } from '../utils.js';
import { CreateCardanoOfferResponse } from '../client.js';

function emptySubTx(): SubTransaction {
  return SubTransaction.fromCore({
    body: {
      inputs: [],
      outputs: [],
    },
    witness: {
      signatures: new Map(),
    },
  });
}

describe('Cardano Offer API', () => {
  it('accepts an enveloped subtx and returns its id', async () => {
    const subTx = emptySubTx();
    const res = await CLIENT.createCardanoOffer(serializeEnvelope(subTx));
    expect(res.status).toBe(202);

    const offer = res.data as typeof CreateCardanoOfferResponse.static;
    expect(offer.offerId).toBe(subTx.getId());
  });

  it('rejects an unsupported envelope version', async () => {
    // [version, era, #6.24(subtx)]: byte 1 is the version, a single-byte uint
    const envelope = serializeEnvelope(emptySubTx());
    envelope[1] += 1;

    const res = await CLIENT.createCardanoOffer(envelope);
    expect(res.status).toBe(400);
    expect(res.data).toMatchObject({ error: 'unsupported-version' });
  });

  it('rejects a malformed envelope', async () => {
    const res = await CLIENT.createCardanoOffer(new Uint8Array([0x01, 0x02, 0x03]));
    expect(res.status).toBe(400);
    expect(res.data).toMatchObject({ error: 'malformed' });
  });
});
