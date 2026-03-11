import { program } from 'commander';
import { runCli, withAppContext, requireNetworkId } from '@capacity-exchange/midnight-node';
import { type TxResult } from '@capacity-exchange/midnight-core';
import { requestWithdrawal } from '../lib/request-withdrawal.js';

function main(): Promise<TxResult> {
  program
    .name('vault:request-withdrawal')
    .description('Submits a bridge withdrawal request to the vault contract')
    .argument('<contractAddress>', 'The address of the deployed vault contract')
    .argument('<amount>', 'Withdrawal amount (in atomic units)')
    .argument('<domainSep>', 'Domain separator (hex)')
    .argument('<cardanoAddress>', 'Cardano address to withdraw to (hex)')
    .parse();

  const networkId = requireNetworkId();
  const [contractAddress, amountStr, domainSep, cardanoAddress] = program.args;

  return withAppContext(networkId, (ctx) =>
    requestWithdrawal(ctx, {
      contractAddress,
      amount: BigInt(amountStr),
      domainSep,
      cardanoAddress,
    })
  );
}

runCli(main);
