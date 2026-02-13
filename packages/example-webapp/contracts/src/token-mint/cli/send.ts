import { program } from 'commander';
import { runCli, withAppContext } from '../../lib/cli.js';
import { send, SendOutput } from '../lib/operations.js';

function main(): Promise<SendOutput> {
  program
    .name('token-mint:send')
    .description('Sends tokens from server wallet to a recipient address')
    .argument('<networkId>', 'Network ID (e.g., undeployed, preview)')
    .argument('<contractAddress>', 'The deployed contract address')
    .argument('<tokenColor>', 'The token color from deployment')
    .argument('<recipientAddress>', 'The recipient shielded address')
    .argument('<amount>', 'Number of tokens to send')
    .parse();

  const [networkId, contractAddress, tokenColor, recipientAddress, amountStr] = program.args;
  const amount = BigInt(amountStr);
  return withAppContext(networkId, (ctx) => send(ctx, contractAddress, tokenColor, recipientAddress, amount));
}

runCli(main);
