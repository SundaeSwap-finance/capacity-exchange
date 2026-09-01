import type { AppContext } from '@sundaeswap/capacity-exchange-nodejs';
import type { TxFinal } from '../coupling/submit.js';

/** How long to wait for a submitted tx to be indexed before giving up. The watch polls the indexer
 *  and has no deadline of its own, so without this a run that submits a tx nothing ever includes
 *  keeps polling for as long as the process is left alive. */
export const INCLUSION_TIMEOUT_MS = 5 * 60_000;

/** Waiting stopped before the chain said anything. Distinct from a failed watch because it means
 *  we stopped looking, not that anything is wrong with the tx. */
export class InclusionTimeout extends Error {
  constructor(txId: string, timeoutMs: number) {
    super(`gave up waiting for ${txId} after ${timeoutMs}ms`);
    this.name = 'InclusionTimeout';
  }
}

/** Waits for a tx to be included, for a bounded time.
 *
 *  Returns undefined when the watch itself failed, which is not evidence about the tx, so a caller
 *  may carry on. Throws InclusionTimeout when the wait ran out, because "we stopped looking" must
 *  not be reported as "the tx did not land". */
export async function awaitInclusion(
  app: AppContext,
  txId: string,
  onWatchFailed: (reason: string) => void,
  timeoutMs: number = INCLUSION_TIMEOUT_MS
): Promise<TxFinal | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expiry = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new InclusionTimeout(txId, timeoutMs)), timeoutMs);
  });
  const watch = app.publicDataProvider.watchForTxData(txId).catch((err: unknown) => {
    onWatchFailed(`waiting for ${txId} failed: ${err instanceof Error ? err.message : String(err)}`);
    return undefined;
  });

  try {
    return await Promise.race([watch, expiry]);
  } finally {
    // Cleared on every path, or a run that finished quickly still holds a timer for the full
    // budget and reports giving up on a tx that already landed.
    clearTimeout(timer);
  }
}
