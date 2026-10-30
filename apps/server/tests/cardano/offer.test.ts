import { beforeAll, describe, it, expect } from 'vitest';
import { serializeEnvelope, SubTransaction, TransactionId, TxIn } from '@capacity-exchange/cardano-core';
import { CLIENT } from '../utils.js';
import { CreateCardanoOfferResponse } from '../client.js';
import { fundServerWallet } from './devnet.js';

type SubTxArgs = {
  inputs?: TxIn[],
}
function buildSubTx({ inputs }: SubTxArgs = {}): SubTransaction {
  return SubTransaction.fromCore({
    body: {
      inputs: inputs ?? [],
      outputs: [],
    },
    witness: {
      signatures: new Map(),
    },
  });
}

describe('Cardano Offer API', () => {
  // The server pays the fee of the transaction it builds around each subtx.
  beforeAll(() => fundServerWallet(10_000_000n));

  it('accepts an enveloped subtx and returns its id', async () => {
    const subTx = buildSubTx();
    const res = await CLIENT.createCardanoOffer(serializeEnvelope(subTx));
    expect(res.status).toBe(202);

    const offer = res.data as typeof CreateCardanoOfferResponse.static;
    expect(offer.offerId).toBe(subTx.getId());
  });

  it('rejects an unsupported envelope version', async () => {
    // [version, era, #6.24(subtx)]: byte 1 is the version, a single-byte uint
    const envelope = serializeEnvelope(buildSubTx());
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

  it('rejects a subtx with nonexistent inputs', async () => {;
    const subTx = buildSubTx({ inputs: [{ txId: TransactionId("00".repeat(32)), index: 0 }]});
    const res = await CLIENT.createCardanoOffer(serializeEnvelope(subTx));
    expect(res.status).toBe(400);
    expect(res.data).toMatchObject({ error: 'malformed' });
  });
});
