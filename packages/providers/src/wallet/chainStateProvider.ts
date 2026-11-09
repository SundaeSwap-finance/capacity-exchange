// graphql must load before the indexer provider; see midnight-core's graphqlFirst.ts.
import 'graphql';
import type { LedgerParameters } from '@midnightntwrk/ledger-v9';
import type { PublicDataProvider } from '@midnight-ntwrk/midnight-js/types';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { getLedgerParameters } from '@sundaeswap/capacity-exchange-core';

/**
 * Provides read-only views of on-chain state needed by the Capacity Exchange SDK.
 *
 * - `queryContractState` is used to look up registered CES server URLs from the on-chain registry.
 * - `getLedgerParameters` returns the chain's current {@link LedgerParameters}, used to estimate
 *   the DUST speck cost of the user's transaction before quoting an exchange.
 */
export interface ChainStateProvider {
  queryContractState: PublicDataProvider['queryContractState'];
  getLedgerParameters(): Promise<LedgerParameters>;
  dispose: () => Promise<void>;
}

/** Builds a {@link ChainStateProvider} backed by a Midnight indexer. */
export function indexerChainStateProvider(indexerUri: string, indexerWsUri: string): ChainStateProvider {
  const publicDataProvider = indexerPublicDataProvider({
    queryURL: indexerUri,
    subscriptionURL: indexerWsUri,
  });
  return {
    queryContractState: (addr, cfg) => publicDataProvider.queryContractState(addr, cfg),
    getLedgerParameters: () => getLedgerParameters(indexerUri),
    dispose: () => publicDataProvider.dispose(),
  };
}
