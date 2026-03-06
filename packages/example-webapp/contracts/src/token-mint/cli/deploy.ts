import { program } from 'commander';
import { runCli, withAppContext } from '@capacity-exchange/midnight-node';
import { deploy, DeployOutput } from '../lib/operations.js';

function main(): Promise<DeployOutput> {
  program
    .name('token-mint:deploy')
    .description('Deploys a new token mint contract')
    .argument('<networkId>', 'Network ID (e.g., undeployed, preview)')
    .argument('[tokenColor]', '32-byte hex string for the token color (random if not provided)')
    .parse();

  const [networkId, tokenColor] = program.args;
  return withAppContext(networkId, (ctx) => deploy(ctx, tokenColor));
}

runCli(main);
