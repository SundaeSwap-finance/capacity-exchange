import { program } from 'commander';
import { runCli, withAppContext } from '../../lib/cli.js';
import { increment, IncrementOutput } from '../lib/operations.js';

function main(): Promise<IncrementOutput> {
  program
    .name('counter:increment')
    .description('Increments a deployed counter contract')
    .argument('<contractAddress>', 'The address of the deployed counter contract')
    .parse();

  const contractAddress = program.args[0];
  return withAppContext('./counter/out', (ctx) => increment(ctx, contractAddress));
}

runCli(main);
