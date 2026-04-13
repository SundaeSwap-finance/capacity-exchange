import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';
import type { Ledger, Witnesses } from '../../out/contract/index.js';

/**
 * Private state holds the preimage s that the caller intends to disclose.
 * Before each `mintReveal` call, we update the stored private
 * state via `providers.privateStateProvider.set(psid, {preimage: s})`, so
 * that when the compiled circuit invokes the witness it returns the right s.
 */
export type CircuitPrivateState = {
  preimage: Uint8Array;
};

export const createPrivateState = (preimage: Uint8Array): CircuitPrivateState => ({
  preimage: Buffer.from(preimage),
});

export const witnesses: Witnesses<CircuitPrivateState> = {
  preimage: ({
    privateState,
  }: WitnessContext<Ledger, CircuitPrivateState>): [CircuitPrivateState, Uint8Array] => [
    privateState,
    privateState.preimage,
  ],
};
