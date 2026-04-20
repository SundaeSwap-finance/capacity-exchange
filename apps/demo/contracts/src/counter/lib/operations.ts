import {
  AppContext,
  buildProviders,
  submitCallTxDirect,
  deployContractWithDryRun,
} from '@sundaeswap/capacity-exchange-nodejs';
import { toTxResult, type TxResult } from '@sundaeswap/capacity-exchange-core';
import { CompiledCounterContract, Counter, CounterContract } from './contract.js';
import { createLogger } from '@sundaeswap/capacity-exchange-nodejs';

const logger = createLogger(import.meta);

export interface DeployOutput {
  contractAddress: string;
  txHash: string;
}

export async function deploy(ctx: AppContext, dryRun = false): Promise<DeployOutput> {
  logger.info(`Deploying counter contract${dryRun ? ' (DRY RUN)' : ''}...`);
  const providers = buildProviders<CounterContract>(ctx, './counter/out');

  const deployed = await deployContractWithDryRun(
    providers,
    {
      compiledContract: CompiledCounterContract,
    },
    dryRun
  );

  logger.info(`Counter deployed at ${deployed.deployTxData.public.contractAddress}`);
  return {
    contractAddress: deployed.deployTxData.public.contractAddress,
    txHash: deployed.deployTxData.public.txHash,
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
  const contractState = await ctx.publicDataProvider.queryContractState(contractAddress);

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
