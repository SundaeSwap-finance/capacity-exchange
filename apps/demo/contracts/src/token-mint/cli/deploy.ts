import { program } from 'commander';
import { shouldStoreMaintenanceKey, runCli, withAppContextFromEnv } from '@sundaeswap/capacity-exchange-nodejs';
import { deploy, DeployOutput } from '../lib/operations.js';

function main(): Promise<DeployOutput> {
  program
    .name('token-mint:deploy')
    .description('Deploys a new token mint contract')
    .argument('<networkId>', 'Network ID (e.g., undeployed, preview)')
    .argument('[tokenColor]', '32-byte hex string for the token color (random if not provided)')
    .option(
      '--no-maintenance-key-secret',
      'Do not store the maintenance signing key in Secrets Manager (refused on mainnet)'
    )
    .parse();

  const [networkId, tokenColor] = program.args;
  const store = shouldStoreMaintenanceKey(
    networkId,
    program.opts<{ maintenanceKeySecret: boolean }>().maintenanceKeySecret
  );
  return withAppContextFromEnv(networkId, (ctx) => deploy(ctx, tokenColor, false, store));
}

runCli(main);
