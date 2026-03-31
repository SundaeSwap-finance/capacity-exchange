import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';
import type { Ledger, Witnesses } from '../../../token-mint/out/contract/index.js';

export type CircuitPrivateState = {
  secret_key: Uint8Array;
  admin_key: Uint8Array;
};

export const createPrivateState = (secretKey: Uint8Array, adminKey?: Uint8Array): CircuitPrivateState => ({
  secret_key: Buffer.from(secretKey),
  admin_key: Buffer.from(adminKey ?? new Uint8Array(32)),
});

export const witnesses: Witnesses<CircuitPrivateState> = {
  local_secret_key: ({
    privateState,
  }: WitnessContext<Ledger, CircuitPrivateState>): [CircuitPrivateState, Uint8Array] => [
    privateState,
    privateState.secret_key,
  ],
  admin_secret_key: ({
    privateState,
  }: WitnessContext<Ledger, CircuitPrivateState>): [CircuitPrivateState, Uint8Array] => [
    privateState,
    privateState.admin_key,
  ],
};
