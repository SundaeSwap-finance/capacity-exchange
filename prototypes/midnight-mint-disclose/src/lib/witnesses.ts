import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';
import type { Ledger, Witnesses } from '../../out/contract/index.js';

/**
 * Private state for the mint-disclose contract. Holds the user's witness
 * secret s'. The contract's `mintReveal` circuit reads this via the
 * `sPrime()` witness function; s' is never disclosed on chain.
 */
export type CircuitPrivateState = {
  sPrime: Uint8Array;
};

export const createPrivateState = (sPrime: Uint8Array): CircuitPrivateState => ({
  sPrime: Buffer.from(sPrime),
});

export const witnesses: Witnesses<CircuitPrivateState> = {
  sPrime: ({
    privateState,
  }: WitnessContext<Ledger, CircuitPrivateState>): [CircuitPrivateState, Uint8Array] => [
    privateState,
    privateState.sPrime,
  ],
};
