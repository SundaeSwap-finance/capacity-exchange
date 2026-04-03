#!/usr/bin/env bun
/**
 * Checks whether a wallet mnemonic file has any shielded token balance.
 * Usage: bun shielded-balance.ts <mnemonic-file> <network>
 *
 * Exit codes:
 *   0 - wallet has shielded balance
 *   1 - wallet has no shielded balance
 *   2 - usage error or sync failure
 */
import { withWalletState } from './wallet-check-helper.ts';

const [mnemonicFile, network] = process.argv.slice(2);

await withWalletState('shielded-balance.ts', mnemonicFile, network, (state) => {
  const balances = state.shielded.balances as Record<string, bigint>;
  const hasBalance = Object.values(balances).some((v) => v > 0n);

  if (hasBalance) {
    const summary = Object.entries(balances)
      .filter(([, v]) => v > 0n)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    console.log(`Shielded balance found: ${summary}`);
    process.exit(0);
  } else {
    console.log('No shielded balance found.');
    process.exit(1);
  }
});