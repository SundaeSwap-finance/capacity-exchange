import type { Contract } from '@midnight-ntwrk/compact-js';
import {
  createUnprovenCallTx,
  verifyContractState,
  type UnprovenCallTxProvidersBase,
  type UnprovenCallTxProvidersWithPrivateState,
} from '@midnight-ntwrk/midnight-js-contracts';
import type { CallTxOptionsBase, CallTxOptionsWithPrivateStateId } from '@midnight-ntwrk/midnight-js-contracts';
import type { UnsubmittedCallTxData } from '@midnight-ntwrk/midnight-js-contracts';

/**
 * Fetches the on-chain contract state and verifies that the local verifier key
 * for `circuitId` matches the one embedded in the deployed contract.
 *
 * Throws `ContractTypeError` (from midnight-js-contracts) on drift.
 */
export async function verifyCircuitVerifierKey(
  providers: Pick<UnprovenCallTxProvidersBase, 'publicDataProvider' | 'zkConfigProvider'>,
  contractAddress: string,
  circuitId: string
): Promise<void> {
  const contractState = await providers.publicDataProvider.queryContractState(contractAddress);
  if (!contractState) {
    throw new Error(
      `Contract not found at address ${contractAddress} — cannot verify circuit verifier key before call`
    );
  }
  const localVerifierKey = await providers.zkConfigProvider.getVerifierKey(circuitId);
  verifyContractState([[circuitId, localVerifierKey]], contractState);
}

/**
 * Wrapper around `createUnprovenCallTx` that runs a verifier-key preflight
 * against the on-chain contract state first. Use this in place of
 * `createUnprovenCallTx` to prevent circuit/contract version drift from
 * silently producing transactions that will fail on submission.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export async function buildUnprovenCallTx<C extends Contract<undefined>, PCK extends Contract.ProvableCircuitId<C>>(
  providers: UnprovenCallTxProvidersBase,
  options: CallTxOptionsBase<C, PCK>
): Promise<UnsubmittedCallTxData<C, PCK>>;
export async function buildUnprovenCallTx<C extends Contract.Any, PCK extends Contract.ProvableCircuitId<C>>(
  providers: UnprovenCallTxProvidersWithPrivateState<C>,
  options: CallTxOptionsWithPrivateStateId<C, PCK>
): Promise<UnsubmittedCallTxData<C, PCK>>;
export async function buildUnprovenCallTx(providers: any, options: any): Promise<any> {
  await verifyCircuitVerifierKey(providers, options.contractAddress, options.circuitId);
  return createUnprovenCallTx(providers, options);
}
