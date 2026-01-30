import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';
import type { Ledger, Witnesses } from '../../../token-mint/out/contract/index.js';

export type CircuitPrivateState = {
  secret_key: Uint8Array;
};

export const createPrivateState = (secretKey: Uint8Array): CircuitPrivateState => ({
  secret_key: Buffer.from(secretKey),
});

export const witnesses: Witnesses<CircuitPrivateState> = {
  local_secret_key: ({
    privateState,
  }: WitnessContext<Ledger, CircuitPrivateState>): [CircuitPrivateState, Uint8Array] => [
    privateState,
    privateState.secret_key,
  ],
};
