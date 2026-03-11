import { ShieldedWallet, type ShieldedWallet as ShieldedWalletType } from '@midnight-ntwrk/wallet-sdk-shielded';
import {
  UnshieldedWallet,
  NoOpTransactionHistoryStorage,
  PublicKey,
} from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import { DustWallet, type DustWallet as DustWalletType } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import type { ZswapSecretKeys, DustSecretKey } from '@midnight-ntwrk/ledger-v7';
import { deriveWalletKeys, type WalletKeys } from './keys.js';
import { DUST_PARAMS } from './params.js';
import type { WalletConfig } from './walletConfig.js';

/** Options for constructing a wallet. Saved state fields enable restoring from a previous session. */
export interface CreateWalletOptions {
  seedHex: string;
  walletConfig: WalletConfig;
  savedShieldedState?: string;
  savedUnshieldedState?: string;
  savedDustState?: string;
}

export interface WalletConnection {
  walletFacade: WalletFacade;
  keys: WalletKeys;
}

/**
 * Derive keys from a seed and construct a WalletFacade with shielded,
 * unshielded, and dust wallets. Does not start or sync.
 */
export function createWallet(options: CreateWalletOptions): WalletConnection {
  const { seedHex, walletConfig, savedShieldedState, savedUnshieldedState, savedDustState } = options;

  const keys = deriveWalletKeys(seedHex, walletConfig.networkId);

  const shieldedWallet = createShieldedWallet(walletConfig, keys.shieldedSecretKeys, savedShieldedState);
  const unshieldedWallet = createUnshieldedWallet(walletConfig, keys.unshieldedKeystore, savedUnshieldedState);
  const dustWallet = createDustWallet(walletConfig, keys.dustSecretKey, savedDustState);

  const walletFacade = new WalletFacade(shieldedWallet, unshieldedWallet, dustWallet);

  return { walletFacade, keys };
}

function createShieldedWallet(
  config: WalletConfig,
  shieldedSecretKeys: ZswapSecretKeys,
  savedState?: string
): ShieldedWalletType {
  if (savedState) {
    try {
      return ShieldedWallet(config).restore(savedState);
    } catch {
      // Fall through to fresh start
    }
  }
  return ShieldedWallet(config).startWithSecretKeys(shieldedSecretKeys);
}

function createUnshieldedWallet(
  config: WalletConfig,
  unshieldedKeystore: WalletKeys['unshieldedKeystore'],
  savedState?: string
) {
  // We don't use transaction history; NoOp avoids accumulating unused data in memory
  const walletBuilder = UnshieldedWallet({
    ...config,
    txHistoryStorage: new NoOpTransactionHistoryStorage(),
  });
  if (savedState) {
    try {
      return walletBuilder.restore(savedState);
    } catch {
      // Fall through to fresh start
    }
  }
  return walletBuilder.startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeystore));
}

function createDustWallet(config: WalletConfig, dustSecretKey: DustSecretKey, savedState?: string): DustWalletType {
  if (savedState) {
    try {
      return DustWallet(config).restore(savedState);
    } catch {
      // Fall through to fresh start
    }
  }
  return DustWallet(config).startWithSecretKey(dustSecretKey, DUST_PARAMS);
}
