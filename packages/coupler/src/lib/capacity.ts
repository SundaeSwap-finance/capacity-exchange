import type { UnboundTransaction } from '@midnight-ntwrk/midnight-js/types';
import type { BridgelessQuote } from '@sundaeswap/capacity-exchange-providers';
import type { CouplingRequest, PricedCoupling } from './couplingParams.js';
import type { EscrowRef } from './escrow.js';

export interface CapacityFragment {
  proven: UnboundTransaction;
  /** The LP's fixed terms, the inputs this capacity fragment is built from. */
  priced: PricedCoupling;
}

/** The LP-side capacity source. The user side depends on this alone, not on how
 *  the capacity is produced. */
export interface CapacityProvider {
  requestCapacity(couplerAddress: string, request: CouplingRequest): Promise<CapacityFragment>;
}

/** LP dust for a swap backed by a foreign escrow, one fn for all foreign chains.
 *  Not yet unified with the native offers path. */
export interface ForeignCapacity {
  requestCapacity(
    couplerAddress: string,
    request: CouplingRequest,
    escrowRef: EscrowRef,
    quote: BridgelessQuote
  ): Promise<CapacityFragment>;
}
