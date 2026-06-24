import * as crypto from 'crypto';
import {
  AppContext,
  buildProviders,
  deployContractWithDryRun,
  createLogger,
} from '@sundaeswap/capacity-exchange-nodejs';
import { CompiledCouplerContract, COUPLER_OUT_DIR, CouplerContract } from './contract.js';
import { createPrivateState } from './witnesses.js';

const logger = createLogger(import.meta);

export interface DeployOutput {
  contractAddress: string;
  txHash: string;
}

/** Deploy a Coupler. Pure contract infrastructure: the User's per-swap secrets
 *  are provisioned separately per swap. The placeholder private state
 *  only satisfies the deploy machinery, since the constructor consumes no witness. */
export async function deploy(ctx: AppContext, dryRun = false): Promise<DeployOutput> {
  const providers = buildProviders<CouplerContract>(ctx, COUPLER_OUT_DIR);
  const privateStateId = crypto.randomBytes(32).toString('hex');
  logger.info(`Deploying Coupler${dryRun ? ' (DRY RUN)' : ''}...`);
  const deployed = await deployContractWithDryRun(
    providers,
    {
      compiledContract: CompiledCouplerContract,
      privateStateId,
      initialPrivateState: createPrivateState(new Uint8Array(32)),
      args: [],
    },
    dryRun
  );
  const contractAddress = deployed.deployTxData.public.contractAddress;
  logger.info(`Coupler deployed at ${contractAddress}`);
  return { contractAddress, txHash: deployed.deployTxData.public.txHash };
}
