import type { FinalizedTransaction } from '@midnight-ntwrk/ledger-v8';
import type { DisclosureResult } from '@sundaeswap/capacity-exchange-coupler/operations';
import { couplingOutcome, type CouplingCommitment, type CouplingOutcome, type DisclosureRead } from './commitments.js';

/** What a submitted tx finalized as, as far as the run needs to care. */
export interface TxFinal {
  status: string;
}

/** The three chain capabilities a coupling run needs, injected so the run is exercisable with
 *  recorded transactions and no node.
 *
 *  `awaitInclusion` is not optional sugar: a disclosure read hits the indexer, which serves
 *  nothing until the tx is indexed, so reading before waiting returns txUnavailable. Naming it
 *  here keeps the ordering a property of this seam rather than of whoever calls it. */
export interface CouplingRunDeps {
  submitTx: (tx: FinalizedTransaction) => Promise<string>;
  awaitInclusion: (txId: string) => Promise<TxFinal | undefined>;
  readDisclosure: (txId: string) => Promise<DisclosureResult>;
}

export interface CouplingRunResult {
  txIds: string[];
  /** What each submission finalized as, in txIds order. undefined means the wait itself failed,
   *  which is a lost confirmation rather than a failed tx. */
  finals: (TxFinal | undefined)[];
  reads: DisclosureRead[];
  outcome: CouplingOutcome;
}

/** One transaction and the couplings it should disclose. */
export interface CouplingSubmission {
  bound: FinalizedTransaction;
  expected: CouplingCommitment[];
}

/** One transaction carrying every coupling in the run. The coupler keeps only the latest coupling
 *  in its cells, so every earlier secret exists nowhere but the transaction, which is the whole
 *  reason the read is per tx rather than against live state. */
export function oneTransaction(bounds: FinalizedTransaction[], expected: CouplingCommitment[]): CouplingSubmission[] {
  if (bounds.length === 0) {
    throw new Error('oneTransaction: nothing to submit');
  }
  return [{ bound: bounds.reduce((merged, next) => merged.merge(next)), expected }];
}

/** Submit every coupling, read back what each submission disclosed, and resolve the result
 *  against the commitments the caller funded. */
export async function runCouplings(
  submissions: CouplingSubmission[],
  deps: CouplingRunDeps
): Promise<CouplingRunResult> {
  if (submissions.length === 0) {
    throw new Error('runCouplings: nothing to submit');
  }
  const txIds: string[] = [];
  for (const { bound } of submissions) {
    txIds.push(await deps.submitTx(bound));
  }

  // Every submission has to land before ANY read, not just its own: the reads go to an indexer
  // that serves a tx only once it is indexed.
  const finals = await Promise.all(txIds.map((txId) => deps.awaitInclusion(txId)));

  const reads: DisclosureRead[] = [];
  for (const txId of txIds) {
    reads.push({ txId, result: await deps.readDisclosure(txId) });
  }
  const expected = submissions.map((sub, i) => ({ txId: txIds[i], couplings: sub.expected }));
  return { txIds, finals, reads, outcome: couplingOutcome(reads, expected) };
}
