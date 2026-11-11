import * as crypto from 'crypto';
import type { SigningKey } from '@midnight-ntwrk/compact-runtime';
import { deployContract } from '@midnight-ntwrk/midnight-js/contracts';
import {
  AppContext,
  buildProviders,
  createLogger,
  recordDeployment,
  sampleMaintenanceKey,
} from '@sundaeswap/capacity-exchange-nodejs';
import {
  CompiledRegistryContract,
  constructorArgs,
  createPrivateState,
  type RegistryContract,
  type RegistrySecretKey,
  type RegistryConstructorArgs,
} from '@sundaeswap/capacity-exchange-registry';
import { getContractOutDir } from '@sundaeswap/capacity-exchange-registry/node';
import { generateRandomSecretKey } from './types.js';
const logger = createLogger(import.meta);

export interface DeployOutput {
  contractAddress: string;
  secretKey: string;
  /** The contract maintenance authority's key, needed to rotate verifier keys. */
  maintenanceSigningKey: SigningKey;
  /** The Secrets Manager secret holding `maintenanceSigningKey`, for rotate-verifier-keys
   *  --signing-key-secret. Absent when it was not stored. */
  maintenanceKeySecretArn?: string;
  txHash: string;
}

/** @param storeMaintenanceKey Store the maintenance signing key in a new Secrets Manager secret. */
export async function deploy(
  ctx: AppContext,
  args: RegistryConstructorArgs,
  storeMaintenanceKey = false
): Promise<DeployOutput> {
  const networkId = ctx.config.network.networkName;
  logger.info('Deploying registry contract...');
  const contractOutDir = getContractOutDir(logger);
  const providers = buildProviders<RegistryContract>(ctx, contractOutDir);

  const privateStateId = crypto.randomBytes(32).toString('hex');
  logger.info(`Generated private state ID: ${privateStateId}`);

  const secretKey: RegistrySecretKey = generateRandomSecretKey();

  const initialPrivateState = createPrivateState(secretKey);
  // Sampled here rather than by deployContract so it can be returned: otherwise its only copy is
  // the local private state store, and losing that leaves the contract unmaintainable.
  // With a secret name, it is stored before the deploy is submitted.
  const maintenanceKey = await sampleMaintenanceKey({
    store: storeMaintenanceKey,
    networkId,
    contract: 'registry',
  });

  const deployed = await deployContract(providers, {
    compiledContract: CompiledRegistryContract,
    privateStateId,
    initialPrivateState,
    signingKey: maintenanceKey.signingKey,
    args: constructorArgs(args),
  });

  const contractAddress = deployed.deployTxData.public.contractAddress;
  const txHash = deployed.deployTxData.public.txHash;
  logger.info(`Registry deployed at ${contractAddress}`);
  await recordDeployment(maintenanceKey, { networkId, contract: 'registry', contractAddress, txHash });

  return {
    contractAddress,
    secretKey: Buffer.from(secretKey).toString('hex'),
    maintenanceSigningKey: maintenanceKey.signingKey,
    maintenanceKeySecretArn: maintenanceKey.secretArn,
    txHash,
  };
}
