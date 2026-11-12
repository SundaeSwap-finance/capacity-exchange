import type { ChainStateProvider } from '@sundaeswap/capacity-exchange-providers';
import type { MidnightChainStateService } from '../services/midnight/chain-state.js';

export const REGISTRY_QUERY_TIMEOUT_MS = 10_000;

/**
 * The chain state the peer fallback reads, adapted for a long-running server:
 * - ledger parameters come from the polled cache rather than a live indexer call per request;
 * - the registry lookup is time-limited, so a hanging indexer can't hold a sponsor request open.
 *   (The indexer client takes no AbortSignal, so the query itself is abandoned, not cancelled.)
 */
export function peerChainStateProvider(
  indexerProvider: ChainStateProvider,
  chainState: MidnightChainStateService,
  timeoutMs = REGISTRY_QUERY_TIMEOUT_MS,
): ChainStateProvider {
  return {
    queryContractState: (address, config) =>
      withTimeout(
        indexerProvider.queryContractState(address, config),
        timeoutMs,
        `Indexer contract state query for ${address}`,
      ),
    getLedgerParameters: async () => chainState.ledgerParameters(),
    dispose: () => indexerProvider.dispose(),
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
