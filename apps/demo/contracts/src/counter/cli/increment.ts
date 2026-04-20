import { program } from 'commander';
import { runCli, withAppContext } from '@sundaeswap/capacity-exchange-nodejs';
import { type TxResult } from '@sundaeswap/capacity-exchange-core';
import { increment } from '../lib/operations.js';

function main(): Promise<TxResult> {
  program
    .name('counter:increment')
    .description('Increments a deployed counter contract')
    .argument('<networkId>', 'Network ID (e.g., undeployed, preview)')
    .argument('<contractAddress>', 'The address of the deployed counter contract')
    .parse();

  const [networkId, contractAddress] = program.args;
  return withAppContext(networkId, (ctx) => increment(ctx, contractAddress));
}

runCli(main);
