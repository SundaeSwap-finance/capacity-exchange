import { program } from 'commander';
import { runCli, withAppContext, requireNetworkId } from '@capacity-exchange/midnight-node';
import { type TxResult } from '@capacity-exchange/midnight-core';
import { deposit } from '../lib/deposit.js';
import { loadKeyPairs } from '../lib/schnorr.js';

function main(): Promise<TxResult> {
  program
    .name('vault:deposit')
    .description('Deposits tokens into a deployed vault via multisig signatures')
    .argument('<contractAddress>', 'Address of the deployed vault contract')
    .argument('<privateStateId>', 'Private state ID from the deploy output')
    .argument('<keysFile>', 'JSON file with key pairs from vault:generate-keys')
    .argument('<amount>', 'Amount to deposit (in atomic units)')
    .argument('<domainSep>', 'Domain separator (64-char hex)')
    .parse();

  const networkId = requireNetworkId();
  const [contractAddress, privateStateId, keysFile, amountStr, domainSep] = program.args;
  const amount = BigInt(amountStr);
  const keyPairs = loadKeyPairs(keysFile);

  return withAppContext(networkId, (ctx) =>
    deposit(ctx, { contractAddress, privateStateId, keyPairs, domainSep, amount })
  );
}

runCli(main);
