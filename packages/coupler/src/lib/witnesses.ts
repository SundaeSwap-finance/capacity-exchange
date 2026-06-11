import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';
import type { Ledger, Witnesses } from '../../out/contract/index.js';

/** Private state for the Coupler: the user's secret s' (never disclosed). */
export type CircuitPrivateState = { sPrime: Uint8Array };

export const createPrivateState = (sPrime: Uint8Array): CircuitPrivateState => {
  if (sPrime.length !== 32) {
    throw new Error(`sPrime must be 32 bytes, got ${sPrime.length}`);
  }
  return { sPrime };
};

export const witnesses: Witnesses<CircuitPrivateState> = {
  sPrime: ({ privateState }: WitnessContext<Ledger, CircuitPrivateState>): [CircuitPrivateState, Uint8Array] => [
    privateState,
    privateState.sPrime,
  ],
};
