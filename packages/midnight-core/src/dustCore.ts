/**
 * Ledger-level access to a synced dust wallet, for code that builds its own dust spends. The wallet
 * SDK seals each variant's core state; on every chain this codebase uses the wallet runs its
 * ledger-v9 (V2) variant, so that is the one read here.
 */
import type { DustWalletState } from '@midnight-ntwrk/wallet-sdk/dust';
import {
  CoinsAndBalances,
  Keys,
  coreStateOf,
  type CoreWallet,
  type DustFullInfo,
} from '@midnight-ntwrk/wallet-sdk/dust/v2';

const coinsAndBalances = CoinsAndBalances.makeDefaultCoinsAndBalancesCapability(undefined, () => ({
  keysCapability: Keys.makeDefaultKeysCapability(),
}));

/** The ledger-v9 core of a dust wallet state. */
export function dustCoreState(dustState: DustWalletState): CoreWallet {
  const core = coreStateOf(dustState);
  if (core._tag === 'None') {
    throw new Error('Dust wallet is still on its ledger-v8 variant; wait for it to sync past the ledger 9 fork');
  }
  return core.value;
}

/**
 * The wallet's spendable dust outputs, with generated dust computed at `time`. Pass the latest block
 * timestamp when building a spend: the wallet's own `availableCoins` reads the wall clock, which can
 * run ahead of the chain and overstate what a UTXO holds.
 */
export function availableDustCoins(dustState: DustWalletState, time: Date): readonly DustFullInfo[] {
  return coinsAndBalances.getAvailableCoins(dustCoreState(dustState), time);
}
