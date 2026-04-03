import { CompiledContract } from '@midnight-ntwrk/compact-js';
import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';
import * as Registry from '../contract/out/contract/index.js';
import type { Ledger, Witnesses } from '../contract/out/contract/index.js';
import type { RegistryConstructorArgs } from './types.js';

export type CircuitPrivateState = {
  secretKey: Uint8Array;
};

export function createPrivateState(secretKey: Uint8Array): CircuitPrivateState {
  if (secretKey.length !== 64) {
    throw new Error(`secretKey must be 64 bytes, got ${secretKey.length}`);
  }
  return { secretKey };
}

export const witnesses: Witnesses<CircuitPrivateState> = {
  secretKey: ({ privateState }: WitnessContext<Ledger, CircuitPrivateState>): [CircuitPrivateState, Uint8Array] => [
    privateState,
    privateState.secretKey,
  ],
};

export type RegistryContract = Registry.Contract<CircuitPrivateState>;

export const CompiledRegistryContract = CompiledContract.make<RegistryContract>('Registry', Registry.Contract).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets('./contract/out'),
);

export function constructorArgs(args: RegistryConstructorArgs): [bigint, bigint] {
  return [args.requiredCollateral, args.maxValidityInterval];
}

export { Registry };
