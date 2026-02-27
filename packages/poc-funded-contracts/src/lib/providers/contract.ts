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
