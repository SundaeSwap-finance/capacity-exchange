import * as crypto from 'crypto';
import type { SigningKey } from '@midnight-ntwrk/compact-runtime';
import {
  AppContext,
  buildProviders,
  deployContractWithDryRun,
  createLogger,
  recordDeployment,
  sampleMaintenanceKey,
} from '@sundaeswap/capacity-exchange-nodejs';
import { createPrivateState, type CouplerContract } from '@sundaeswap/capacity-exchange-coupler/operations';
import { CompiledCouplerContract, COUPLER_OUT_DIR } from './contract.js';

const logger = createLogger(import.meta);

export interface DeployOutput {
  contractAddress: string;
  txHash: string;
  /** The contract maintenance authority's key, needed to rotate verifier keys. */
  maintenanceSigningKey: SigningKey;
  /** The Secrets Manager secret holding `maintenanceSigningKey`, for rotate-verifier-keys
   *  --signing-key-secret. Absent when it was not stored. */
  maintenanceKeySecretArn?: string;
}

/** Deploy a Coupler. Pure contract infrastructure: the User's per-swap secrets
 *  are provisioned separately per swap. The placeholder private state
 *  only satisfies the deploy machinery, since the constructor consumes no witness. */
export async function deploy(ctx: AppContext, dryRun = false, storeMaintenanceKey = false): Promise<DeployOutput> {
  const networkId = ctx.config.network.networkName;
  const providers = buildProviders<CouplerContract>(ctx, COUPLER_OUT_DIR);
  const privateStateId = crypto.randomBytes(32).toString('hex');
  logger.info(`Deploying Coupler${dryRun ? ' (DRY RUN)' : ''}...`);
  // Sampled here rather than by deployContract so it can be returned (and, with a secret name,
  // stored before the deploy is submitted): otherwise its only copy is the local private state store.
  const maintenanceKey = await sampleMaintenanceKey({
    store: storeMaintenanceKey,
    networkId,
    contract: 'coupler',
    dryRun,
  });
  const deployed = await deployContractWithDryRun(
    providers,
    {
      compiledContract: CompiledCouplerContract,
      privateStateId,
      initialPrivateState: createPrivateState(new Uint8Array(32)),
      signingKey: maintenanceKey.signingKey,
    },
    dryRun
  );
  const contractAddress = deployed.deployTxData.public.contractAddress;
  const txHash = deployed.deployTxData.public.txHash;
  logger.info(`Coupler deployed at ${contractAddress}`);
  await recordDeployment(maintenanceKey, { networkId, contract: 'coupler', contractAddress, txHash });
  return {
    contractAddress,
    txHash,
    maintenanceSigningKey: maintenanceKey.signingKey,
    maintenanceKeySecretArn: maintenanceKey.secretArn,
  };
}
