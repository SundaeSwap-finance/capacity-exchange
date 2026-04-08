import * as crypto from 'crypto';
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { AppContext, buildProviders } from '@capacity-exchange/midnight-node';
// import { createPrivateState, NativePoint } from 'contract.ts';
import { createLogger } from '@capacity-exchange/midnight-node';
import { CompiledRegistryContract, constructorArgs, createPrivateState, RegistryContract } from './contract.js';
import { SecretKey, RegistryConstructorArgs } from './types.js';

const logger = createLogger(import.meta);


export interface DeployOutput {
  contractAddress: string;
  txHash: string;
}

export async function deploy(ctx: AppContext, secretKey: SecretKey, args: RegistryConstructorArgs): Promise<DeployOutput> {
  logger.info('Deploying vault contract...');
  const providers = buildProviders<RegistryContract>(ctx, '../contract/out');

  const privateStateId = crypto.randomBytes(32).toString('hex');
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
    txHash: deployed.deployTxData.public.txHash,
  };
}