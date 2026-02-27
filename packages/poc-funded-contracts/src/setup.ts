import * as fs from 'fs';
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { AppContext, createAppContext } from './lib/app-context.js';
import { getAppConfigById } from './lib/config.js';
import { buildProviders, submitCallTxDirect } from './lib/providers/contract.js';
import { CompiledPocContract, Poc, PocContract } from './contract.js';
import { createLogger } from './lib/logger.js';

const logger = createLogger(import.meta);

const DEPLOYED_ADDRESS_PATH = '.deployed-address.json';

interface DeployedAddress {
  networkId: string;
  contractAddress: string;
  txHash: string;
}

function loadDeployedAddress(networkId: string): DeployedAddress | null {
  if (!fs.existsSync(DEPLOYED_ADDRESS_PATH)) {
    return null;
  }
  const data = JSON.parse(fs.readFileSync(DEPLOYED_ADDRESS_PATH, 'utf-8')) as DeployedAddress;
  if (data.networkId !== networkId) {
    return null;
  }
  return data;
}

function saveDeployedAddress(deployed: DeployedAddress): void {
  fs.writeFileSync(DEPLOYED_ADDRESS_PATH, JSON.stringify(deployed, null, 2));
}

export interface SetupResult {
  ctx: AppContext;
  contractAddress: string;
  txHash: string;
}

export async function setup(networkId: string): Promise<SetupResult> {
  const config = getAppConfigById(networkId);
  setNetworkId(config.networkId);

  logger.info(`Setting up for network: ${networkId} (pid: ${process.pid})`);
  const ctx = await createAppContext(config);
  logger.info('App context ready');

  const cached = loadDeployedAddress(networkId);
  if (cached) {
    logger.info(`Using cached contract at ${cached.contractAddress}`);
    return { ctx, contractAddress: cached.contractAddress, txHash: cached.txHash };
  }

  logger.info('Deploying poc contract...');
  const providers = buildProviders<PocContract>(ctx, './contract/out');
  const deployed = await deployContract(providers, {
    compiledContract: CompiledPocContract,
  });

  const contractAddress = deployed.deployTxData.public.contractAddress;
  const txHash = deployed.deployTxData.public.txHash;
  logger.info(`Contract deployed at ${contractAddress} (tx: ${txHash})`);

  saveDeployedAddress({ networkId, contractAddress, txHash });

  return { ctx, contractAddress, txHash };
}

export async function callIncrement(ctx: AppContext, contractAddress: string): Promise<string> {
  logger.info(`Calling increment at ${contractAddress}...`);
  const providers = buildProviders<PocContract>(ctx, './contract/out');

  const result = await submitCallTxDirect<PocContract, 'increment'>(providers, {
    contractAddress,
    compiledContract: CompiledPocContract,
    circuitId: 'increment',
  });

  logger.info(`Increment confirmed at block ${result.public.blockHeight}`);
  return result.public.txHash;
}

export async function queryCounter(ctx: AppContext, contractAddress: string): Promise<bigint> {
  const contractState = await ctx.publicDataProvider.queryContractState(contractAddress);
  if (!contractState) {
    throw new Error(`Contract not found at ${contractAddress}`);
  }
  const ledgerState = Poc.ledger(contractState.data);
  return ledgerState.counter;
}
