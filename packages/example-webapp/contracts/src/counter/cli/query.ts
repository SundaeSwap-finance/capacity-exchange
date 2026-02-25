import { program } from 'commander';
import { runCli, withAppContext } from '@capacity-exchange/components/midnight';
import { query, QueryOutput } from '../lib/operations.js';

function main(): Promise<QueryOutput> {
  program
    .name('counter:query')
    .description('Queries the current value of a deployed counter contract')
    .argument('<networkId>', 'Network ID (e.g., undeployed, preview)')
    .argument('<contractAddress>', 'The address of the deployed counter contract')
    .parse();

  const [networkId, contractAddress] = program.args;
  return withAppContext(networkId, (ctx) => query(ctx, contractAddress));
}

runCli(main);
