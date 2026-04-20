import type { LedgerParameters } from '@midnight-ntwrk/ledger-v8';
import type { PublicDataProvider } from '@midnight-ntwrk/midnight-js-types';

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
}
