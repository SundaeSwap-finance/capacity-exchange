import type { DustSecretKey } from '@midnight-ntwrk/ledger-v8';
import type { DustWalletState } from '@midnight-ntwrk/wallet-sdk/dust';
import { CoreWallet, type UnprovenDustSpend } from '@midnight-ntwrk/wallet-sdk/dust/v1';

/** Identifies one dust output, stable for as long as it stays unspent. */
export function dustUtxoId(utxo: { token: { backingNight: unknown; mtIndex: bigint } }): string {
  return `${String(utxo.token.backingNight)}#${utxo.token.mtIndex}`;
}

/** A dust spend and an id for the UTXO it consumed, unique per dust output. */
export interface DustSpend {
  spend: UnprovenDustSpend;
  utxoId: string;
}

/**
 * Build a dust spend of `vFeeSpecks` (consumed entirely). `ctime` must be the
 * latest block timestamp. It gates both selection and the spend. Throws when no
 * single UTXO covers the fee.
 *
 * A spent UTXO stays in the wallet's available set until the spend settles, so pass
 * `exclude` to keep a caller that builds several transactions at once off the ones it
 * has already used. How that is tracked is the caller's business.
 */
export function createDustSpend(
  dustState: DustWalletState,
  dustSecretKey: DustSecretKey,
  vFeeSpecks: bigint,
  ctime: Date,
  exclude: ReadonlySet<string> = new Set()
): DustSpend {
  const utxos = dustState.capabilities.coinsAndBalances.getAvailableCoins(dustState.state, ctime);
  const utxo = utxos.find((u) => u.generatedNow >= vFeeSpecks && !exclude.has(dustUtxoId(u)));
  if (!utxo) {
    throw new Error(`No dust UTXO with ${vFeeSpecks} specks available`);
  }
  const [spends] = CoreWallet.spendCoins(
    dustState.state,
    dustSecretKey,
    [{ token: utxo.token, value: vFeeSpecks }],
    ctime
  );
  return { spend: spends[0], utxoId: dustUtxoId(utxo) };
}
