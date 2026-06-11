import type { DustSecretKey } from '@midnight-ntwrk/ledger-v8';
import type { DustWalletState } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { CoreWallet, type UnprovenDustSpend } from '@midnight-ntwrk/wallet-sdk-dust-wallet/v1';

/**
 * Build a dust spend of `vFeeSpecks` from the wallet's freshest dust state.
 * The full vFee is consumed by the network, so size it deliberately. `ctime`
 * must be the latest block timestamp. Throws when no single UTXO covers the
 * fee.
 */
export function createDustSpend(
  dustState: DustWalletState,
  dustSecretKey: DustSecretKey,
  vFeeSpecks: bigint,
  ctime: Date
): UnprovenDustSpend {
  const utxos = dustState.availableCoinsWithFullInfo(new Date());
  const utxo = utxos.find((u) => u.generatedNow >= vFeeSpecks);
  if (!utxo) {
    throw new Error(`No dust UTXO with ${vFeeSpecks} specks available`);
  }
  const [spends] = CoreWallet.spendCoins(
    dustState.state,
    dustSecretKey,
    [{ token: utxo.token, value: vFeeSpecks }],
    ctime
  );
  return spends[0];
}
