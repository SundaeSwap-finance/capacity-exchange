import { program } from 'commander';
import { runCli, withAppContextFromEnv } from '@sundaeswap/capacity-exchange-nodejs';
import { deploy, DeployOutput } from '../lib/operations.js';

function main(): Promise<DeployOutput> {
  program
    .name('token-mint:deploy')
    .description('Deploys a new token mint contract')
    .argument('<networkId>', 'Network ID (e.g., undeployed, preview)')
    .argument('[tokenColor]', '32-byte hex string for the token color (random if not provided)')
    .parse();

  const [networkId, tokenColor] = program.args;
  return withAppContextFromEnv(networkId, (ctx) => deploy(ctx, tokenColor));
}

runCli(main);
