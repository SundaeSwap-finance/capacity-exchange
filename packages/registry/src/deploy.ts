import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { AppContext, buildProviders } from '@capacity-exchange/midnight-node';
import { createLogger } from '@capacity-exchange/midnight-node';
import { CompiledRegistryContract, constructorArgs, createPrivateState, RegistryContract } from './contract.js';
import { RegistryKey, RegistryConstructorArgs, generateRandomRegistryKey } from './types.js';

const logger = createLogger(import.meta);

export interface DeployOutput {
  contractAddress: string;
  txHash: string;
}

export async function deploy(ctx: AppContext, args: RegistryConstructorArgs): Promise<DeployOutput> {
  logger.info('Deploying vault contract...');
  const contractOutDir = path.resolve(fileURLToPath(import.meta.url), '../../contract/out');
  const providers = buildProviders<RegistryContract>(ctx, contractOutDir);

  const privateStateId = crypto.randomBytes(32).toString('hex');
  logger.info(`Generated private state ID: ${privateStateId}`);

  const secretKey: RegistryKey = generateRandomRegistryKey();
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

  const privateKeys = {
    privateStateId,
    secretKey: Buffer.from(secretKey).toString('hex'),
    contractAddress,
  };
  fs.writeFileSync('.registry-private-keys.json', JSON.stringify(privateKeys, null, 2));
  logger.info('Saved private keys to .registry-private-keys.json');

  return {
    contractAddress,
    txHash: deployed.deployTxData.public.txHash,
  };
}
