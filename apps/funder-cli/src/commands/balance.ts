import { CardanoCli, utxoRef } from '../cardano/cli.js';
import type { Config } from '../config.js';
import { formatValue } from '../cardano/value.js';
import { formatAda, plain, step, warn, wrote } from '../log.js';
import { minUtxoLovelace } from '../tx/subtx.js';
import { decodeBech32Address } from '../ces/simulate.js';
import { signingKeyPath, walletDir, workPath, writeJson, ARTIFACTS, type Selection } from './state.js';

export interface BalanceOptions {
  callerWallet: string;
}

/**
 * Shows the caller's UTxOs and, more importantly, how much of their ADA is actually spendable.
 * A wallet holding tokens necessarily holds ADA too, so a bare total reads as "plenty for a
 * fee" when in fact every lovelace is pinned as the minimum for an output that has to be
 * re-created.
 */
export function runBalance(config: Config, options: BalanceOptions): void {
  const cli = new CardanoCli(config);
  const dir = walletDir(options.callerWallet);
  const address = cli.deriveAddress(signingKeyPath(options.callerWallet), dir);

  step('balance', `cardano-cli query utxo --address ${address} --testnet-magic ${config.testnetMagic}`);
  const utxos = cli.queryUtxo(address);
  plain('');
  if (utxos.length === 0) {
    warn('this wallet holds nothing. Fund it from the faucet first.');
    return;
  }
  for (const utxo of utxos) {
    plain(`  ${utxoRef(utxo).slice(0, 8)}…#${utxo.index}   ${formatValue(utxo.value)}`);
  }

  const pp = cli.queryProtocolParams();
  const addressBytes = decodeBech32Address(address);
  let total = 0n;
  let locked = 0n;
  for (const utxo of utxos) {
    total += utxo.value.lovelace;
    // Re-creating an output costs at least its minimum; only the excess is free for fees.
    const required = minUtxoLovelace({ address: addressBytes, value: utxo.value }, pp.utxoCostPerByte);
    locked += utxo.value.assets.size > 0 ? min(required, utxo.value.lovelace) : 0n;
  }
  const available = total - locked;

  plain('');
  plain('ADA');
  plain(`  total                      ${formatAda(total)}`);
  plain(`  locked as min-UTxO         ${formatAda(locked)}    to re-create the token output`);
  plain('  ─'.repeat(1) + '─'.repeat(33));
  plain(`  available for fees         ${formatAda(available)}`);
  plain('');
  if (available <= 0n) {
    warn("every transaction needs a fee in ADA. This wallet can't pay one.");
  }

  // Remember the richest token-bearing UTxO so `build` need not re-choose it.
  const withTokens = utxos.filter((u) => u.value.assets.size > 0);
  const chosen = (withTokens.length > 0 ? withTokens : utxos).reduce((a, b) =>
    b.value.lovelace > a.value.lovelace ? b : a
  );
  const selection: Selection = {
    address,
    txHash: chosen.txHash,
    index: chosen.index,
    lovelace: chosen.value.lovelace.toString(),
    assets: Object.fromEntries([...chosen.value.assets].map(([u, q]) => [u, q.toString()])),
  };
  const selectionPath = workPath(config, ARTIFACTS.selection);
  writeJson(selectionPath, selection);
  wrote('balance', selectionPath);
}

function min(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}
