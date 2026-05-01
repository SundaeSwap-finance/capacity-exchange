import * as crypto from 'crypto';
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { AppContext, buildProviders, createLogger } from '@sundaeswap/capacity-exchange-nodejs';
import { CompiledRegistryContract, constructorArgs, createPrivateState, type RegistryContract } from './contract.js';
import { getContractOutDir } from './utils.js';
import { RegistrySecretKey, RegistryConstructorArgs, generateRandomSecretKey } from './types.js';

const logger = createLogger(import.meta);

export interface DeployOutput {
  contractAddress: string;
  secretKey: string;
  txHash: string;
}

export async function deploy(ctx: AppContext, args: RegistryConstructorArgs): Promise<DeployOutput> {
  logger.info('Deploying registry contract...');
  const contractOutDir = getContractOutDir(logger);
  const providers = buildProviders<RegistryContract>(ctx, contractOutDir);

  const privateStateId = crypto.randomBytes(32).toString('hex');
  logger.info(`Generated private state ID: ${privateStateId}`);

  const secretKey: RegistrySecretKey = generateRandomSecretKey();

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
    secretKey: Buffer.from(secretKey).toString('hex'),
    txHash: deployed.deployTxData.public.txHash,
  };
}
