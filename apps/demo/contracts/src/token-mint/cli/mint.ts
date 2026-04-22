import { program } from 'commander';
import { runCli, withAppContextFromEnv } from '@sundaeswap/capacity-exchange-nodejs';
import { mint, MintOutput } from '../lib/operations.js';

function main(): Promise<MintOutput> {
  program
    .name('token-mint:mint')
    .description('Mints tokens on a deployed token mint contract')
    .argument('<networkId>', 'Network ID (e.g., undeployed, preview)')
    .argument('<contractAddress>', 'The deployed contract address')
    .argument('<privateStateId>', 'The private state ID from deployment')
    .argument('<amount>', 'Number of tokens to mint')
    .parse();

  const [networkId, contractAddress, privateStateId, amountStr] = program.args;
  const amount = BigInt(amountStr);
  return withAppContextFromEnv(networkId, (ctx) => mint(ctx, contractAddress, privateStateId, amount));
}

runCli(main);
