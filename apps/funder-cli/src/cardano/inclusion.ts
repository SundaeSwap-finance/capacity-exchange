import type { CardanoCli } from './cli.js';

export type InclusionState = 'included' | 'pending' | 'unknown';

export interface InclusionResult {
  state: InclusionState;
  /** Seconds spent waiting, when this came from a poll. */
  waitedSeconds?: number;
}

/** How many output indices to probe when deciding whether a transaction landed. */
const PROBE_OUTPUTS = 8;

/**
 * Works out whether a transaction has been included.
 *
 * `txid` is whatever its outputs are keyed by. For a sub-transaction that is its own TxId,
 * since the ledger adds a sub-transaction's outputs under the sub-transaction's id (SUBUTXO
 * runs the same UTxO update over the sub-transaction body). The mempool only knows top-level
 * transactions, though, so `mempoolTxid` names the batch carrying it when that is known.
 *
 * `unknown` covers two cases that look identical from the UTxO set: the transaction was never
 * accepted, and it was included but every output has since been spent. Neither applies to a
 * transaction this tool just submitted, so callers treat it as "not yet".
 */
export function checkInclusion(cli: CardanoCli, txid: string, mempoolTxid = txid): InclusionResult {
  const refs = Array.from({ length: PROBE_OUTPUTS }, (_, i) => `${txid}#${i}`);
  if (cli.queryUtxoByRefs(refs).length > 0) {
    return { state: 'included' };
  }
  return { state: cli.txMempoolExists(mempoolTxid) ? 'pending' : 'unknown' };
}

export interface WaitOptions {
  /** See `checkInclusion`. */
  mempoolTxid?: string;
  timeoutSeconds: number;
  pollSeconds: number;
  /** Called on each poll so the caller can report progress. */
  onPoll?: (elapsedSeconds: number, state: InclusionState) => void;
}

/**
 * Polls until a transaction is included or the timeout elapses.
 *
 * Inclusion here is a few minutes rather than seconds. The Leios announcement, vote and
 * diffusion periods run to thousands of slots, but those govern endorser-block certification;
 * a transaction still reaches a ranking block well before that.
 */
export async function waitForInclusion(cli: CardanoCli, txid: string, options: WaitOptions): Promise<InclusionResult> {
  const started = Date.now();
  for (;;) {
    const elapsed = Math.round((Date.now() - started) / 1000);
    const result = checkInclusion(cli, txid, options.mempoolTxid ?? txid);
    if (result.state === 'included') {
      return { state: 'included', waitedSeconds: elapsed };
    }
    options.onPoll?.(elapsed, result.state);
    if (elapsed >= options.timeoutSeconds) {
      return { ...result, waitedSeconds: elapsed };
    }
    await new Promise((resolve) => setTimeout(resolve, options.pollSeconds * 1000));
  }
}

/** Renders a duration the way a human would say it. */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`;
}
