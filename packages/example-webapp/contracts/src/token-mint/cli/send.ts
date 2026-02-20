import { program } from 'commander';
import { deriveTokenColor, sendShieldedTokens } from '@capacity-exchange/core';
import { runCli, withAppContext } from '../../lib/cli.js';

function main() {
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
  const derivedTokenColor = deriveTokenColor(tokenColor, contractAddress);

  return withAppContext(networkId, (ctx) =>
    sendShieldedTokens(
      ctx.walletContext.walletFacade,
      ctx.walletContext.keys,
      derivedTokenColor,
      recipientAddress,
      amount
    )
  );
}

runCli(main);
