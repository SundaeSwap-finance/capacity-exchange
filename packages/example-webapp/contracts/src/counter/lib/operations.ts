import { deployContract, findDeployedContract, submitCallTx } from '@midnight-ntwrk/midnight-js-contracts';
import { AppContext } from '../../lib/app-context.js';
import { getContractProviders } from '../../lib/providers/contract.js';
import { createCounterContract, Counter, CounterContract } from './contract.js';

export interface DeployOutput {
  contractAddress: string;
  txHash: string;
}

export async function deploy(ctx: AppContext): Promise<DeployOutput> {
  console.error('Deploying counter contract...');
  const providers = getContractProviders<CounterContract>(ctx);
  const contract = createCounterContract();

  const deployed = await deployContract(providers, {
    contract,
  });

  console.error(`Counter deployed at ${deployed.deployTxData.public.contractAddress}`);
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
  console.error(`Incrementing counter at ${contractAddress}...`);
  const providers = getContractProviders<CounterContract>(ctx);
  const contract = createCounterContract();

  await findDeployedContract(providers, {
    contract,
    contractAddress,
  });

  const result = await submitCallTx(providers, {
    contract,
    contractAddress,
    circuitId: 'increment',
  });

  console.error(`Increment tx confirmed at block ${result.public.blockHeight}`);
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
  console.error(`Querying counter at ${contractAddress}...`);
  const contractState = await ctx.publicDataProvider.queryContractState(contractAddress);

  if (!contractState) {
    throw new Error(`Contract not found at address: ${contractAddress}`);
  }

  const ledgerState = Counter.ledger(contractState.data);
  console.error(`Counter value: ${ledgerState.round}`);

  return {
    contractAddress,
    round: ledgerState.round.toString(),
  };
}
