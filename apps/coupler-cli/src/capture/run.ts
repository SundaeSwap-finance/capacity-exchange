import type { FinalizedTransaction } from '@midnight-ntwrk/ledger-v8';
import { uint8ArrayToHex } from '@sundaeswap/capacity-exchange-core';
import type { DisclosureResult } from '@sundaeswap/capacity-exchange-coupler/operations';
import type { CapturedCoupling } from './fixtures.js';

/** What capturing needs from a chain, injected so the capture is exercisable with recorded
 *  transactions and no node. */
export interface CaptureDeps {
  prepareOne: () => Promise<FinalizedTransaction>;
  submitTx: (tx: FinalizedTransaction) => Promise<string>;
  awaitInclusion: (txId: string) => Promise<unknown>;
  readDisclosure: (txId: string, bound: FinalizedTransaction) => Promise<DisclosureResult>;
}

/** Record one real coupling for the offline decode tests. A fixture entry pairs one transaction's
 *  bytes with the one secret it disclosed, so a capture is one coupling on one transaction. More
 *  entries come from running again against the same coupler, which appends. */
export async function captureCoupling(deps: CaptureDeps): Promise<CapturedCoupling> {
  const bound = await deps.prepareOne();
  const txId = await deps.submitTx(bound);
  await deps.awaitInclusion(txId);
  const result = await deps.readDisclosure(txId, bound);
  if (!result.ok) {
    throw new Error(`capture: ${txId} did not decode: ${result.error.kind}`);
  }
  const [disclosure] = result.couplings;
  if (!disclosure) {
    throw new Error(`capture: ${txId} disclosed nothing to save`);
  }
  return { txId, raw: uint8ArrayToHex(bound.serialize()), disclosure };
}
