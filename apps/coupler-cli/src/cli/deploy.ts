import { program } from 'commander';
import { shouldStoreMaintenanceKey, runCli, withAppContextFromEnv } from '@sundaeswap/capacity-exchange-nodejs';
import { deploy, type DeployOutput } from '../chain/deploy.js';

function main(): Promise<DeployOutput> {
  program
    .name('coupler:deploy')
    .description('Deploys a Coupler contract and outputs its address and tx hash.')
    .argument('<networkId>', 'Network ID (e.g., undeployed, preview)')
    .option(
      '--no-maintenance-key-secret',
      'Do not store the maintenance signing key in Secrets Manager (refused on mainnet)'
    )
    .parse();

  const [networkId] = program.args;
  const store = shouldStoreMaintenanceKey(
    networkId,
    program.opts<{ maintenanceKeySecret: boolean }>().maintenanceKeySecret
  );
  return withAppContextFromEnv(networkId, (ctx) => deploy(ctx, false, store));
}

runCli(main, { pretty: true });
