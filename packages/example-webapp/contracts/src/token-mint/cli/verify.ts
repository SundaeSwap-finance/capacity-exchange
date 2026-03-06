import { program } from 'commander';
import { runCli, withAppContext } from '@capacity-exchange/midnight-node';
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
  return withAppContext(networkId, (ctx) => verify(ctx, contractAddress, tokenColor));
}

runCli(main);
