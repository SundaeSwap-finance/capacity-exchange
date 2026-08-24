import type { PublicDataProvider, MidnightProvider, ProofProvider } from '@midnight-ntwrk/midnight-js/types';
import type { LedgerParameters } from '@midnight-ntwrk/ledger-v8';
import type { Logger } from '@sundaeswap/capacity-exchange-core';

/** What the user-side coupling needs, held once and reused across swaps. Capabilities, not
 *  endpoints, so a caller can supply fakes and the coupling never learns a URL. */
export interface CouplerContext {
  /** The user's coin public key, the only wallet capability the coupling needs. */
  coinPublicKey: string;
  publicDataProvider: PublicDataProvider;
  midnightProvider: MidnightProvider;
  proofProvider: ProofProvider;
  /** Current ledger parameters. The fee basis for every fragment this coupling builds. */
  getLedgerParameters(): Promise<LedgerParameters>;
  logger: Logger;
}
