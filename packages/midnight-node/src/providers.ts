import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import type { MidnightProviders } from '@midnight-ntwrk/midnight-js/types';
import { SucceedEntirely } from '@midnight-ntwrk/midnight-js/types';
import type { Contract } from '@midnight-ntwrk/compact-js';
import { sampleSigningKey } from '@midnight-ntwrk/compact-runtime';
import {
  createUnprovenDeployTx,
  deployContract,
  submitTx,
  TxFailedError,
  type Ledger9CallTxOptionsBase,
  type Ledger9CallTxOptionsWithPrivateStateId,
  type Ledger9ContractProviders,
  type Ledger9DeployContractOptions,
  type Ledger9DeployedContract,
  type Ledger9FinalizedCallTxData,
  type Ledger9UnsubmittedCallTxData,
} from '@midnight-ntwrk/midnight-js/contracts';
import { buildUnprovenCallTx, DEFAULT_TX_TTL_SECONDS } from '@sundaeswap/capacity-exchange-core';
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
    proofProvider: httpClientProofProvider({
      url: ctx.config.network.endpoints.proofServerUrl,
      zkConfigProvider,
    }),
    publicDataProvider: ctx.publicDataProvider,
    walletProvider: ctx.walletContext.walletProvider,
    zkConfigProvider,
    config: { networkId: ctx.config.network.networkId, ttlSeconds: DEFAULT_TX_TTL_SECONDS },
  };
}

// Prove, balance, and optionally submit an unproven call transaction.
async function finalizeCallTx<C extends Contract.Any, ICK extends Contract.ProvableCircuitId<C>>(
  providers: Ledger9ContractProviders<C>,
  callTxData: Ledger9UnsubmittedCallTxData<C, ICK>,
  contractAddress: string,
  circuitId: ICK,
  dryRun = false
): Promise<Ledger9FinalizedCallTxData<C, ICK>> {
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
      },
    } as unknown as Ledger9FinalizedCallTxData<C, ICK>;
  }

  const finalized = await submitTx(providers, {
    unprovenTx: callTxData.private.unprovenTx,
    circuitId,
  });

  if (finalized.status !== SucceedEntirely) {
    throw new TxFailedError('call', finalized, { circuitId, contractAddress });
  }

  return {
    ...callTxData,
    public: {
      ...callTxData.public,
      ...finalized,
    },
  } as Ledger9FinalizedCallTxData<C, ICK>;
}

export async function submitCallTxDirect<C extends Contract<undefined>, ICK extends Contract.ProvableCircuitId<C>>(
  providers: Ledger9ContractProviders<C>,
  options: Ledger9CallTxOptionsBase<C, ICK>,
  dryRun = false
): Promise<Ledger9FinalizedCallTxData<C, ICK>> {
  const callTxData = await buildUnprovenCallTx<C, ICK>(providers, options);
  return finalizeCallTx(providers, callTxData, options.contractAddress, options.circuitId, dryRun);
}

// Same as submitCallTxDirect but for contracts with private state.
// Updates the private state store on success.
export async function submitStatefulCallTxDirect<C extends Contract.Any, ICK extends Contract.ProvableCircuitId<C>>(
  providers: Ledger9ContractProviders<C>,
  options: Ledger9CallTxOptionsWithPrivateStateId<C, ICK>,
  dryRun = false
): Promise<Ledger9FinalizedCallTxData<C, ICK>> {
  const callTxData = await buildUnprovenCallTx<C, ICK>(providers, options);
  const result = await finalizeCallTx(providers, callTxData, options.contractAddress, options.circuitId, dryRun);

  if (!dryRun) {
    await providers.privateStateProvider
      .forContract(options.contractAddress)
      .set(options.privateStateId, callTxData.private.nextPrivateState);
  }

  return result;
}

// Deploy a contract, or in dry-run mode: build, prove, and balance without submitting.
export async function deployContractWithDryRun<C extends Contract.Any>(
  providers: Ledger9ContractProviders<C>,
  options: Ledger9DeployContractOptions<C>,
  dryRun = false
): Promise<Ledger9DeployedContract<C>> {
  if (!dryRun) {
    // deployContract is overloaded per options shape; the union of both shapes is what we accept.
    const deploy = deployContract as (
      providers: Ledger9ContractProviders<C>,
      options: Ledger9DeployContractOptions<C>
    ) => Promise<Ledger9DeployedContract<C>>;
    return deploy(providers, options);
  }

  // Dry-run: build and prove+balance without submitting. The signing key is throwaway, since
  // nothing is deployed for it to maintain.
  const unprovenData = await createUnprovenDeployTx(providers, {
    ...options,
    signingKey: sampleSigningKey(),
  });

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
  } as unknown as Ledger9DeployedContract<C>;
}
