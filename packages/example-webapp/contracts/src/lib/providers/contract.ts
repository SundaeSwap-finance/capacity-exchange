import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import type { MidnightProviders, FinalizedTxData } from '@midnight-ntwrk/midnight-js-types';
import { SucceedEntirely } from '@midnight-ntwrk/midnight-js-types';
import type { Contract } from '@midnight-ntwrk/compact-js';
import {
  createUnprovenCallTx,
  submitTx,
  CallTxFailedError,
  type ContractProviders,
} from '@midnight-ntwrk/midnight-js-contracts';
import type {
  CallTxOptionsWithPrivateStateId,
  CallTxOptionsBase,
  FinalizedCallTxData,
  UnsubmittedCallTxData,
} from '@midnight-ntwrk/midnight-js-contracts';
import { AppContext } from '../app-context.js';

export function buildProviders<C extends Contract.Any>(
  ctx: AppContext,
  zkConfigDir: string
): MidnightProviders<Contract.ImpureCircuitId<C>> {
  const zkConfigProvider = new NodeZkConfigProvider<Contract.ImpureCircuitId<C>>(zkConfigDir);
  return {
    midnightProvider: ctx.midnightProvider,
    privateStateProvider: ctx.privateStateProvider,
    proofProvider: httpClientProofProvider(ctx.proofServerUrl, zkConfigProvider),
    publicDataProvider: ctx.publicDataProvider,
    walletProvider: ctx.walletContext.walletProvider,
    zkConfigProvider,
  };
}

// Prove, balance, submit, and check status of an unproven call transaction.
async function finalizeCallTx<C extends Contract.Any, ICK extends Contract.ImpureCircuitId<C>>(
  providers: ContractProviders<C>,
  callTxData: UnsubmittedCallTxData<C, ICK>,
  circuitId: ICK
): Promise<FinalizedCallTxData<C, ICK>> {
  const finalized = await submitTx(providers, {
    unprovenTx: callTxData.private.unprovenTx,
    circuitId,
  });

  if (finalized.status !== SucceedEntirely) {
    throw new CallTxFailedError(finalized, circuitId);
  }

  return {
    ...callTxData,
    public: {
      ...callTxData.public,
      ...(finalized satisfies FinalizedTxData),
    },
  };
}

export async function submitCallTxDirect<C extends Contract<undefined>, ICK extends Contract.ImpureCircuitId<C>>(
  providers: ContractProviders<C>,
  options: CallTxOptionsBase<C, ICK>
): Promise<FinalizedCallTxData<C, ICK>> {
  const callTxData = await createUnprovenCallTx(providers, options);
  return finalizeCallTx(providers, callTxData, options.circuitId);
}

// Same as submitCallTxDirect but for contracts with private state.
// Updates the private state store on success.
export async function submitStatefulCallTxDirect<C extends Contract.Any, ICK extends Contract.ImpureCircuitId<C>>(
  providers: ContractProviders<C>,
  options: CallTxOptionsWithPrivateStateId<C, ICK>
): Promise<FinalizedCallTxData<C, ICK>> {
  const callTxData = await createUnprovenCallTx(providers, options);
  const result = await finalizeCallTx(providers, callTxData, options.circuitId);

  await providers.privateStateProvider.set(options.privateStateId, callTxData.private.nextPrivateState);

  return result;
}
