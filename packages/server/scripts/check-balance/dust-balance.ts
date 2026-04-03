#!/usr/bin/env bun
/**
 * Checks whether a wallet mnemonic file has any DUST balance.
 * Usage: bun dust-balance.ts <mnemonic-file> <network>
 *
 * Exit codes:
 *   0 - wallet has DUST balance
 *   1 - wallet has no DUST balance
 *   2 - usage error or sync failure
 */
import { withWalletState } from './wallet-check-helper.ts';

const [mnemonicFile, network] = process.argv.slice(2);

await withWalletState('dust-balance.ts', mnemonicFile, network, (state) => {
  const dustBalance = state.dust.balance(new Date()) as bigint;

  if (dustBalance > 0n) {
    console.log(`DUST balance found: ${dustBalance}`);
    process.exit(0);
  } else {
    console.log('No DUST balance found.');
    process.exit(1);
  }
});