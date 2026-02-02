import { program } from 'commander';
import { runCli, withAppContext } from '../../lib/cli.js';
import { send, SendOutput } from '../lib/operations.js';

function main(): Promise<SendOutput> {
  program
    .name('token-mint:send')
    .description('Sends minted tokens to a specified wallet')
    .argument('<derivedTokenColor>', 'The derived token color (from mint output)')
    .argument('<amount>', 'Number of tokens to send')
    .argument('<recipientSeed>', 'Hex seed of the recipient wallet')
    .parse();

  const [derivedTokenColor, amountStr, recipientSeed] = program.args;
  const amount = BigInt(amountStr);
  return withAppContext('./token-mint/out', (ctx) => send(ctx, derivedTokenColor, amount, recipientSeed));
}

runCli(main);
