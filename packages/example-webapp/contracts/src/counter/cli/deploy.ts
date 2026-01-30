import { program } from 'commander';
import { runCli, withAppContext } from '../../lib/cli.js';
import { deploy, DeployOutput } from '../lib/operations.js';

function main(): Promise<DeployOutput> {
  program
    .name('counter:deploy')
    .description('Deploys a new counter contract and outputs JSON with the contract address.')
    .parse();

  return withAppContext('./counter/out', (ctx) => deploy(ctx));
}

runCli(main);
