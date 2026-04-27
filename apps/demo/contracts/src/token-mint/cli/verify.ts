import { program } from 'commander';
import { runCli, withAppContextFromEnv } from '@sundaeswap/capacity-exchange-nodejs';
import { verify, VerifyOutput } from '../lib/operations.js';

function main(): Promise<VerifyOutput> {
  program
    .name('token-mint:verify')
    .description('Verifies token balance for a deployed token mint contract')
    .argument('<networkId>', 'Network ID (e.g., undeployed, preview)')
    .argument('<contractAddress>', 'The deployed contract address')
    .argument('<tokenColor>', 'The token color used during deployment')
    .parse();

  const [networkId, contractAddress, tokenColor] = program.args;
  return withAppContextFromEnv(networkId, (ctx) => verify(ctx, contractAddress, tokenColor));
}

runCli(main);
