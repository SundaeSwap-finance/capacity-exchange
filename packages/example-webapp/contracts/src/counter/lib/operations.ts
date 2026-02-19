import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { AppContext } from '../../lib/app-context.js';
import { buildProviders, submitCallTxDirect } from '../../lib/providers/contract.js';
import { CompiledCounterContract, Counter, CounterContract } from './contract.js';
import { createLogger } from '../../lib/logger.js';

const logger = createLogger(import.meta);

export interface DeployOutput {
  contractAddress: string;
  txHash: string;
}

export async function deploy(ctx: AppContext): Promise<DeployOutput> {
  logger.info('Deploying counter contract...');
  const providers = buildProviders<CounterContract>(ctx, './counter/out');

  const deployed = await deployContract(providers, {
    compiledContract: CompiledCounterContract,
  });

  logger.info(`Counter deployed at ${deployed.deployTxData.public.contractAddress}`);
  return {
    contractAddress: deployed.deployTxData.public.contractAddress,
    txHash: deployed.deployTxData.public.txHash,
  };
}

export interface IncrementOutput {
  txHash: string;
  contractAddress: string;
  blockHeight: string;
  blockHash: string;
}

export async function increment(ctx: AppContext, contractAddress: string): Promise<IncrementOutput> {
  logger.info(`Incrementing counter at ${contractAddress}...`);
  const providers = buildProviders<CounterContract>(ctx, './counter/out');

  const result = await submitCallTxDirect<CounterContract, 'increment'>(providers, {
    contractAddress,
    compiledContract: CompiledCounterContract,
    circuitId: 'increment',
  });

  logger.info(`Increment tx confirmed at block ${result.public.blockHeight}`);
  return {
    txHash: result.public.txHash,
    contractAddress,
    blockHeight: result.public.blockHeight.toString(),
    blockHash: result.public.blockHash,
  };
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
