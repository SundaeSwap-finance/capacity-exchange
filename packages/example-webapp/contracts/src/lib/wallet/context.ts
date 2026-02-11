import { createHash } from 'crypto';
import type { DustSecretKey, ZswapSecretKeys } from '@midnight-ntwrk/ledger-v7';
import { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { ShieldedWallet } from '@midnight-ntwrk/wallet-sdk-shielded';
import {
  UnshieldedWallet,
  InMemoryTransactionHistoryStorage,
  PublicKey,
  type UnshieldedKeystore,
} from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import type { AppConfig } from '../config/types.js';
import { DUST_PARAMS } from '../config/params.js';
import { DustWalletProvider } from './provider.js';
import { type WalletKeys, deriveWalletKeys } from './keys.js';
import { type WalletConfiguration, createWalletConfiguration } from './config.js';
import { clearWalletState, loadWalletState, saveWalletState } from './storage.js';
import { createLogger } from '../logger.js';

const logger = createLogger(import.meta);

export class WalletSyncTimeoutError extends Error {
  readonly _tag = 'WalletSyncTimeoutError' as const;
  constructor(timeoutMs: number) {
    super(
      `Wallet sync timed out after ${timeoutMs / 1000}s. ` +
        `Try running 'just clean', re-deploying contracts, and restarting the server.`
    );
    this.name = 'WalletSyncTimeoutError';
  }
}

export interface WalletContext {
  walletFacade: WalletFacade;
  walletProvider: DustWalletProvider;
  keys: WalletKeys;
}

function createShieldedWallet(config: WalletConfiguration, secretKeys: ZswapSecretKeys, suffix: string) {
  const savedState = loadWalletState('shielded', suffix);
  if (savedState) {
    try {
      return ShieldedWallet(config).restore(savedState);
    } catch {
      logger.log('Failed to restore shielded wallet, clearing saved state and starting fresh');
      clearWalletState('shielded', suffix);
    }
  }
  return ShieldedWallet(config).startWithSecretKeys(secretKeys);
}

function createDustWallet(config: WalletConfiguration, secretKey: DustSecretKey, suffix: string) {
  const savedState = loadWalletState('dust', suffix);
  if (savedState) {
    try {
      return DustWallet(config).restore(savedState);
    } catch {
      logger.log('Failed to restore dust wallet, clearing saved state and starting fresh');
      clearWalletState('dust', suffix);
    }
  }
  return DustWallet(config).startWithSecretKey(secretKey, DUST_PARAMS);
}

function createUnshieldedWallet(config: WalletConfiguration, keystore: UnshieldedKeystore) {
  return UnshieldedWallet({
    ...config,
    txHistoryStorage: new InMemoryTransactionHistoryStorage(),
  }).startWithPublicKey(PublicKey.fromKeyStore(keystore));
}

async function saveWalletStates(facade: WalletFacade, suffix: string): Promise<void> {
  try {
    const [shieldedState, dustState] = await Promise.all([
      facade.shielded.serializeState(),
      facade.dust.serializeState(),
    ]);
    saveWalletState('shielded', suffix, shieldedState);
    saveWalletState('dust', suffix, dustState);
  } catch {
    logger.log('Failed to save wallet state');
  }
}

export async function createWalletContext(config: AppConfig): Promise<WalletContext> {
  const seedHex = config.seed.toString('hex');
  const keys = deriveWalletKeys(seedHex, config.networkId);
  const walletConfig = createWalletConfiguration(config);
  const suffix = createHash('sha256')
    .update(config.networkId + seedHex)
    .digest('hex')
    .slice(0, 12);

  logger.log('Creating wallets...');
  const shieldedWallet = createShieldedWallet(walletConfig, keys.shieldedSecretKeys, suffix);
  const dustWallet = createDustWallet(walletConfig, keys.dustSecretKey, suffix);
  const unshieldedWallet = createUnshieldedWallet(walletConfig, keys.unshieldedKeystore);

  const walletFacade = new WalletFacade(shieldedWallet, unshieldedWallet, dustWallet);
  const walletProvider = new DustWalletProvider(walletFacade, keys.shieldedSecretKeys, keys.dustSecretKey);

  logger.log('Starting wallet facade...');
  await walletFacade.start(keys.shieldedSecretKeys, keys.dustSecretKey);

  logger.log('Syncing wallets...');
  const SYNC_TIMEOUT_MS = 120_000;
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new WalletSyncTimeoutError(SYNC_TIMEOUT_MS)), SYNC_TIMEOUT_MS)
  );
  await Promise.race([
    Promise.all([walletFacade.shielded.waitForSyncedState(), walletFacade.dust.waitForSyncedState()]),
    timeout,
  ]);
  logger.log('Wallets synced');

  await saveWalletStates(walletFacade, suffix);

  return { walletFacade, walletProvider, keys };
}
