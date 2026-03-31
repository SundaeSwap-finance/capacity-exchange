import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import type { MidnightProviders, FinalizedTxData } from '@midnight-ntwrk/midnight-js-types';
import { SucceedEntirely } from '@midnight-ntwrk/midnight-js-types';
import type { Contract } from '@midnight-ntwrk/compact-js';
import {
  createUnprovenCallTx,
  createUnprovenDeployTx,
  deployContract,
  submitTx,
  CallTxFailedError,
  type ContractProviders,
} from '@midnight-ntwrk/midnight-js-contracts';
import type {
  CallTxOptionsWithPrivateStateId,
  CallTxOptionsBase,
  FinalizedCallTxData,
  UnsubmittedCallTxData,
  DeployContractOptions,
  DeployedContract,
} from '@midnight-ntwrk/midnight-js-contracts';
import { AppContext } from './appContext.js';
import { createLogger } from './createLogger.js';

const logger = createLogger(import.meta);

export function buildProviders<C extends Contract.Any>(
  ctx: AppContext,
  zkConfigDir: string
): MidnightProviders<Contract.ProvableCircuitId<C>> {
  const zkConfigProvider = new NodeZkConfigProvider<Contract.ProvableCircuitId<C>>(zkConfigDir);
  return {
    midnightProvider: ctx.midnightProvider,
    privateStateProvider: ctx.privateStateProvider,
    proofProvider: httpClientProofProvider(ctx.proofServerUrl, zkConfigProvider),
    publicDataProvider: ctx.publicDataProvider,
    walletProvider: ctx.walletContext.walletProvider,
    zkConfigProvider,
  };
}

// Prove, balance, and optionally submit an unproven call transaction.
async function finalizeCallTx<C extends Contract.Any, ICK extends Contract.ProvableCircuitId<C>>(
  providers: ContractProviders<C>,
  callTxData: UnsubmittedCallTxData<C, ICK>,
  circuitId: ICK,
  dryRun = false
): Promise<FinalizedCallTxData<C, ICK>> {
  if (dryRun) {
    logger.info('Proving transaction...');
    const provenTx = await providers.proofProvider.proveTx(callTxData.private.unprovenTx);
    logger.info('Balancing transaction...');
    await providers.walletProvider.balanceTx(provenTx);
    logger.info('[DRY RUN] Transaction proved and balanced successfully — skipping submission');

    // Return a synthetic result without submitting
    return {
      ...callTxData,
      public: {
        ...callTxData.public,
        status: SucceedEntirely,
        txHash: '(dry-run)',
        blockHash: '(dry-run)',
      } as FinalizedCallTxData<C, ICK>['public'],
    };
  }

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

export async function submitCallTxDirect<C extends Contract<undefined>, ICK extends Contract.ProvableCircuitId<C>>(
  providers: ContractProviders<C>,
  options: CallTxOptionsBase<C, ICK>,
  dryRun = false
): Promise<FinalizedCallTxData<C, ICK>> {
  const callTxData = await createUnprovenCallTx(providers, options);
  return finalizeCallTx(providers, callTxData, options.circuitId, dryRun);
}

// Same as submitCallTxDirect but for contracts with private state.
// Updates the private state store on success.
export async function submitStatefulCallTxDirect<C extends Contract.Any, ICK extends Contract.ProvableCircuitId<C>>(
  providers: ContractProviders<C>,
  options: CallTxOptionsWithPrivateStateId<C, ICK>,
  dryRun = false
): Promise<FinalizedCallTxData<C, ICK>> {
  const callTxData = await createUnprovenCallTx(providers, options);
  const result = await finalizeCallTx(providers, callTxData, options.circuitId, dryRun);

  if (!dryRun) {
    await providers.privateStateProvider.set(options.privateStateId, callTxData.private.nextPrivateState);
  }

  return result;
}

// Deploy a contract, or in dry-run mode: build, prove, and balance without submitting.
export async function deployContractWithDryRun<C extends Contract.Any>(
  providers: ContractProviders<C>,
  options: DeployContractOptions<C>,
  dryRun = false
): Promise<DeployedContract<C>> {
  if (!dryRun) {
    return deployContract(providers, options as any);
  }

  // Dry-run: build and prove+balance without submitting
  const unprovenData = await createUnprovenDeployTx(providers, options as any);

  logger.info('Proving deploy transaction...');
  const provenTx = await providers.proofProvider.proveTx(unprovenData.private.unprovenTx);
  logger.info('Balancing deploy transaction...');
  await providers.walletProvider.balanceTx(provenTx);
  logger.info('[DRY RUN] Deploy transaction proved and balanced successfully — skipping submission');

  return {
    deployTxData: {
      ...unprovenData,
      public: {
        ...unprovenData.public,
        status: SucceedEntirely,
        txHash: '(dry-run)',
        blockHash: '(dry-run)',
      },
    },
  } as DeployedContract<C>;
}
