import * as crypto from 'crypto';
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { AppContext, buildProviders } from '@capacity-exchange/midnight-node';
import { CompiledVaultContract, VaultContract } from '../lib/contract.js';
import { createPrivateState, NativePoint } from '../lib/witnesses.js';
import { createLogger } from '@capacity-exchange/midnight-node';

const logger = createLogger(import.meta);

export interface DeployParams {
  publicKeys: NativePoint[];
}

export interface DeployOutput {
  contractAddress: string;
  txHash: string;
}

export async function deploy(ctx: AppContext, params: DeployParams): Promise<DeployOutput> {
  logger.info('Deploying vault contract...');
  const providers = buildProviders<VaultContract>(ctx, './vault/out');

  const privateStateId = crypto.randomBytes(32).toString('hex');
  const initialPrivateState = createPrivateState(params.publicKeys);

  const deployed = await deployContract(providers, {
    compiledContract: CompiledVaultContract,
    privateStateId,
    initialPrivateState,
  });

  const contractAddress = deployed.deployTxData.public.contractAddress;
  logger.info(`Vault deployed at ${contractAddress}`);
  return {
    contractAddress,
    txHash: deployed.deployTxData.public.txHash,
  };
}
