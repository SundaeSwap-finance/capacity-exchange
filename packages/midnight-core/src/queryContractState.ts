import { ContractState } from '@midnight-ntwrk/compact-runtime';
import type { BlockHashConfig, BlockHeightConfig, PublicDataProvider } from '@midnight-ntwrk/midnight-js/types';

/**
 * Reads a contract's current state and decodes it with compact-runtime, the object a compiled
 * contract's `ledger(state.data)` accepts.
 *
 * Every chain this codebase talks to is on ledger-v9, but a contract deployed before the fork keeps
 * its v8-encoded state until a post-fork transaction touches it. Such a state cannot be read by the
 * ledger-v9 runtime, so it is refused with a pointer to the fix rather than misread.
 */
export async function queryContractState(
  publicDataProvider: Pick<PublicDataProvider, 'queryContractState'>,
  contractAddress: string,
  config?: BlockHeightConfig | BlockHashConfig
): Promise<ContractState | null> {
  const read = await publicDataProvider.queryContractState(contractAddress, config);
  if (!read) {
    return null;
  }
  if (read.contractState.era !== 'v9') {
    throw new Error(
      `Contract ${contractAddress} still has ${read.contractState.era}-era state. ` +
        `It has not been touched since the ledger 9 fork; rotate its verifier keys (rotate-verifier-keys) to migrate it.`
    );
  }
  return read.contractState.deserialize({ v9: ContractState });
}
