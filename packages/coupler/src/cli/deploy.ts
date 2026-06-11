import { program } from 'commander';
import { runCli, withAppContextFromEnv } from '@sundaeswap/capacity-exchange-nodejs';
import { deploy, DeployOutput } from '../lib/operations.js';

function main(): Promise<DeployOutput> {
  program
    .name('coupler:deploy')
    .description('Deploys a Coupler contract and outputs its address and tx hash.')
    .argument('<networkId>', 'Network ID (e.g., undeployed, preview)')
    .parse();

  const [networkId] = program.args;
  return withAppContextFromEnv(networkId, (ctx) => deploy(ctx));
}

runCli(main, { pretty: true });
