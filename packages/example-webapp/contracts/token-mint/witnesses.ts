import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';
import type { Ledger, Witnesses } from './out/contract';

export type CircuitPrivateState = {
  secret_key: Uint8Array;
};

export const createPrivateState = (secretKey: Uint8Array): CircuitPrivateState => ({
  secret_key: Buffer.from(secretKey),
});

export const createInitialPrivateState = (secretKey: Buffer) => createPrivateState(secretKey);

export const witnesses: Witnesses<CircuitPrivateState> = {
  local_secret_key: ({
    privateState,
  }: WitnessContext<Ledger, CircuitPrivateState>): [CircuitPrivateState, Uint8Array] => [
      privateState,
      privateState.secret_key,
    ],
};
