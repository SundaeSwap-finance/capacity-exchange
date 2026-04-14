import * as crypto from 'crypto';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { AppContext, buildProviders, createLogger } from '@capacity-exchange/midnight-node';
import { CompiledRegistryContract, constructorArgs, createPrivateState, RegistryContract } from './contract.js';
import { RegistrySecretKey, RegistryConstructorArgs, generateRandomSecretKey } from './types.js';

const logger = createLogger(import.meta);

export interface DeployOutput {
  contractAddress: string;
  privateStateId: string;
  secretKey: RegistrySecretKey;
  txHash: string;
}

export async function deploy(ctx: AppContext, args: RegistryConstructorArgs): Promise<DeployOutput> {
  logger.info('Deploying registry contract...');
  const contractOutDir = path.resolve(fileURLToPath(import.meta.url), '../../contract/out');
  const providers = buildProviders<RegistryContract>(ctx, contractOutDir);

  const privateStateId = crypto.randomBytes(32).toString('hex');
  logger.info(`Generated private state ID: ${privateStateId}`);

  const secretKey: RegistrySecretKey = generateRandomSecretKey();
  logger.info(`Generated secret key: ${Buffer.from(secretKey).toString('hex').slice(0, 16)}...`);

  const initialPrivateState = createPrivateState(secretKey);

  const deployed = await deployContract(providers, {
    compiledContract: CompiledRegistryContract,
    privateStateId,
    initialPrivateState,
    args: constructorArgs(args),
  });

  const contractAddress = deployed.deployTxData.public.contractAddress;
  logger.info(`Registry deployed at ${contractAddress}`);

  return {
    contractAddress,
    secretKey,
    privateStateId,
    txHash: deployed.deployTxData.public.txHash,
  };
}
