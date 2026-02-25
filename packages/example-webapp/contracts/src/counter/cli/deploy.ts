import { program } from 'commander';
import { runCli, withAppContext } from '@capacity-exchange/components/midnight';
import { deploy, DeployOutput } from '../lib/operations.js';

function main(): Promise<DeployOutput> {
  program
    .name('counter:deploy')
    .description('Deploys a new counter contract and outputs JSON with the contract address.')
    .argument('<networkId>', 'Network ID (e.g., undeployed, preview)')
    .parse();

  const [networkId] = program.args;
  return withAppContext(networkId, (ctx) => deploy(ctx));
}

runCli(main);
