import { program } from 'commander';
import { runCli, withAppContext, requireNetworkId } from '@capacity-exchange/midnight-node';
import { type TxResult } from '@capacity-exchange/midnight-core';
import { deposit } from '../node/deposit.js';
import { loadKeyPairs } from '../node/schnorr.js';

function main(): Promise<TxResult> {
  program
    .name('vault:deposit')
    .description('[Internal] Deposits tokens into a deployed vault via multisig signatures')
    .argument('<contractAddress>', 'Address of the deployed vault contract')
    .argument('<keysFile>', 'JSON file with key pairs from vault:generate-keys')
    .argument('<amount>', 'Amount to deposit (in atomic units)')
    .argument('<domainSep>', 'Domain separator (64-char hex)')
    .parse();

  const networkId = requireNetworkId();
  const [contractAddress, keysFile, amountStr, domainSep] = program.args;
  const amount = BigInt(amountStr);
  const keyPairs = loadKeyPairs(keysFile);

  return withAppContext(networkId, (ctx) => deposit(ctx, { contractAddress, keyPairs, domainSep, amount }));
}

runCli(main);
