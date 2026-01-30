import { program } from 'commander';
import { runCli, withAppContext } from '../../lib/cli.js';
import { query, QueryOutput } from '../lib/operations.js';

function main(): Promise<QueryOutput> {
  program
    .name('counter:query')
    .description('Queries the current value of a deployed counter contract')
    .argument('<contractAddress>', 'The address of the deployed counter contract')
    .parse();

  const contractAddress = program.args[0];
  return withAppContext('./counter/out', (ctx) => query(ctx, contractAddress));
}

runCli(main);
