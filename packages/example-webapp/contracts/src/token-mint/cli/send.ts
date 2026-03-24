import { program } from 'commander';
import { deriveTokenColor, sendShieldedTokens } from '@capacity-exchange/midnight-core';
import { runCli, withAppContext } from '@capacity-exchange/midnight-node';
import { MidnightBech32m, ShieldedAddress } from '@midnight-ntwrk/wallet-sdk-address-format';

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
    sendShieldedTokens(ctx.walletContext.walletFacade, ctx.walletContext.keys, [
      { type: derivedTokenColor, receiverAddress: MidnightBech32m.parse(recipientAddress).decode(ShieldedAddress, networkId), amount },
    ])
  );
}

runCli(main);
