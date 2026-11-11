import {
  AppContext,
  buildProviders,
  submitCallTxDirect,
  deployContractWithDryRun,
  recordDeployment,
  sampleMaintenanceKey,
} from '@sundaeswap/capacity-exchange-nodejs';
import { queryContractState, toTxResult, type TxResult } from '@sundaeswap/capacity-exchange-core';
import { CompiledCounterContract, Counter, CounterContract } from './contract.js';
import { createLogger } from '@sundaeswap/capacity-exchange-nodejs';
import type { SigningKey } from '@midnight-ntwrk/compact-runtime';

const logger = createLogger(import.meta);

export interface DeployOutput {
  contractAddress: string;
  /** The contract maintenance authority's key, needed to rotate verifier keys. */
  maintenanceSigningKey: SigningKey;
  /** The Secrets Manager secret holding `maintenanceSigningKey`, for rotate-verifier-keys
   *  --signing-key-secret. Absent when it was not stored. */
  maintenanceKeySecretArn?: string;
  txHash: string;
}

/** @param storeMaintenanceKey Store the maintenance signing key in a new Secrets Manager secret. */
export async function deploy(ctx: AppContext, dryRun = false, storeMaintenanceKey = false): Promise<DeployOutput> {
  const networkId = ctx.config.network.networkName;
  logger.info(`Deploying counter contract${dryRun ? ' (DRY RUN)' : ''}...`);
  const providers = buildProviders<CounterContract>(ctx, './counter/out');
  // Sampled here rather than by deployContract so it can be returned: otherwise its only copy is
  // the local private state store, and losing that leaves the contract unmaintainable.
  // With a secret name, it is stored before the deploy is submitted.
  const maintenanceKey = await sampleMaintenanceKey({
    store: storeMaintenanceKey,
    networkId,
    contract: 'counter',
    dryRun,
  });

  const deployed = await deployContractWithDryRun(
    providers,
    {
      compiledContract: CompiledCounterContract,
      signingKey: maintenanceKey.signingKey,
    },
    dryRun
  );

  const contractAddress = deployed.deployTxData.public.contractAddress;
  const txHash = deployed.deployTxData.public.txHash;
  logger.info(`Counter deployed at ${contractAddress}`);
  await recordDeployment(maintenanceKey, { networkId, contract: 'counter', contractAddress, txHash });
  return {
    contractAddress,
    maintenanceSigningKey: maintenanceKey.signingKey,
    maintenanceKeySecretArn: maintenanceKey.secretArn,
    txHash,
  };
}

export async function increment(ctx: AppContext, contractAddress: string): Promise<TxResult> {
  logger.info(`Incrementing counter at ${contractAddress}...`);
  const providers = buildProviders<CounterContract>(ctx, './counter/out');

  const result = await submitCallTxDirect<CounterContract, 'increment'>(providers, {
    contractAddress,
    compiledContract: CompiledCounterContract,
    circuitId: 'increment',
  });

  logger.info(`Increment tx confirmed at block ${result.public.blockHeight}`);
  return toTxResult(contractAddress, result.public);
}

export interface QueryOutput {
  contractAddress: string;
  round: string;
}

export async function query(ctx: AppContext, contractAddress: string): Promise<QueryOutput> {
  logger.info(`Querying counter at ${contractAddress}...`);
  const contractState = await queryContractState(ctx.publicDataProvider, contractAddress);

  if (!contractState) {
    throw new Error(`Contract not found at address: ${contractAddress}`);
  }

  const ledgerState = Counter.ledger(contractState.data);
  logger.info(`Counter value: ${ledgerState.round}`);

  return {
    contractAddress,
    round: ledgerState.round.toString(),
  };
}
