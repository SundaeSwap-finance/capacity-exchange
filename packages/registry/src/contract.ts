import * as path from 'path';
import { fileURLToPath } from 'url';

import { CompiledContract } from '@midnight-ntwrk/compact-js';
import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';
import * as Registry from '../contract/out/contract/index.js';
import type { Ledger, Witnesses } from '../contract/out/contract/index.js';
import type { RegistrySecretKey, RegistryConstructorArgs } from './types.js';
import { AppContext, buildProviders } from '@capacity-exchange/midnight-node';
import { Logger } from '@capacity-exchange/midnight-core';

export type CircuitPrivateState = {
  secretKey: RegistrySecretKey;
};

export function createPrivateState(secretKey: RegistrySecretKey): CircuitPrivateState {
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
  CompiledContract.withCompiledFileAssets('./contract/out')
);

export function constructorArgs(args: RegistryConstructorArgs): [bigint, bigint] {
  return [args.requiredCollateral, args.maxValidityInterval];
}

export function getContractOutDir(logger: Logger) {
  const contractOutDir = path.resolve(fileURLToPath(import.meta.url), '../../contract/out');
  logger.debug(`Contract output directory: ${contractOutDir}`);

  return contractOutDir;
}

export async function getProviders(
  ctx: AppContext,
  contractAddress: string,
  privateStateId: string,
  secretKey: RegistrySecretKey,
  logger: Logger
) {
  const providers = buildProviders<RegistryContract>(ctx, getContractOutDir(logger));
  providers.privateStateProvider.setContractAddress(contractAddress);

  // Load the secret key into the private state provider so the `secretKey()` witness
  // has a value to read during circuit execution.
  await providers.privateStateProvider.set(privateStateId, createPrivateState(secretKey));
  logger.info(`Setting private state for privateStateId: ${privateStateId}`);

  return providers;
}

export { Registry };
