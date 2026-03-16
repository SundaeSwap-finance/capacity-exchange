import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';
import type { Ledger, Witnesses } from '../../../vault/out/contract/index.js';

export type NativePoint = { x: bigint; y: bigint };

export type CircuitPrivateState = {
  publicKeys: NativePoint[];
};

export const createPrivateState = (publicKeys: NativePoint[]): CircuitPrivateState => ({
  publicKeys,
});

export const witnesses: Witnesses<CircuitPrivateState> = {
  getRequiredKeys: ({
    privateState,
  }: WitnessContext<Ledger, CircuitPrivateState>): [CircuitPrivateState, NativePoint[]] => [
    privateState,
    privateState.publicKeys,
  ],
};
