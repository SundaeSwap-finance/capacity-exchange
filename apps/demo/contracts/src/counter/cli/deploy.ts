import { program } from 'commander';
import { runCli, withAppContextFromEnv } from '@sundaeswap/capacity-exchange-nodejs';
import { deploy, DeployOutput } from '../lib/operations.js';

function main(): Promise<DeployOutput> {
  program
    .name('counter:deploy')
    .description('Deploys a new counter contract and outputs JSON with the contract address.')
    .argument('<networkId>', 'Network ID (e.g., undeployed, preview)')
    .parse();

  const [networkId] = program.args;
  return withAppContextFromEnv(networkId, (ctx) => deploy(ctx));
}

runCli(main);
