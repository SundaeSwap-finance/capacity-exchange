import type { DustSecretKey, ZswapSecretKeys } from '@midnight-ntwrk/ledger-v6';
import { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { ShieldedWallet } from '@midnight-ntwrk/wallet-sdk-shielded';
import {
  UnshieldedWallet,
  InMemoryTransactionHistoryStorage,
  PublicKey,
  type UnshieldedKeystore,
} from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import type { NetworkConfig } from '../config/env.js';
import { DUST_PARAMS } from '../config/env.js';
import type { Startable } from '../startable.js';
import { DustWalletProvider } from './provider.js';
import { deriveWalletKeys } from './keys.js';
import { createWalletConfiguration } from './config.js';
import { loadWalletState, saveWalletState } from './storage.js';
import { createLogger } from '../logger.js';

const logger = createLogger(import.meta);

type WalletConfig = ReturnType<typeof createWalletConfiguration>;

export interface WalletContext {
  walletFacade: WalletFacade;
  walletProvider: DustWalletProvider;
}

function createShieldedWallet(config: WalletConfig, secretKeys: ZswapSecretKeys) {
  const savedState = loadWalletState('shielded');
  if (savedState) {
    try {
      return ShieldedWallet(config).restore(savedState);
    } catch {
      logger.log('Failed to restore shielded wallet, starting fresh');
    }
  }
  return ShieldedWallet(config).startWithSecretKeys(secretKeys);
}

function createDustWallet(config: WalletConfig, secretKey: DustSecretKey) {
  const savedState = loadWalletState('dust');
  if (savedState) {
    try {
      return DustWallet(config).restore(savedState);
    } catch {
      logger.log('Failed to restore dust wallet, starting fresh');
    }
  }
  return DustWallet(config).startWithSecretKey(secretKey, DUST_PARAMS);
}

function createUnshieldedWallet(config: WalletConfig, keystore: UnshieldedKeystore) {
  return UnshieldedWallet({
    ...config,
    txHistoryStorage: new InMemoryTransactionHistoryStorage(),
  }).startWithPublicKey(PublicKey.fromKeyStore(keystore));
}

async function saveWalletStates(facade: WalletFacade): Promise<void> {
  try {
    const [shieldedState, dustState] = await Promise.all([
      facade.shielded.serializeState(),
      facade.dust.serializeState(),
    ]);
    saveWalletState('shielded', shieldedState);
    saveWalletState('dust', dustState);
  } catch {
    logger.log('Failed to save wallet state');
  }
}

export class WalletContextStarter implements Startable<WalletContext> {
  #keys: ReturnType<typeof deriveWalletKeys>;
  #walletConfig: WalletConfig;

  constructor(config: NetworkConfig, seedHex: string) {
    this.#keys = deriveWalletKeys(seedHex, config.networkId);
    this.#walletConfig = createWalletConfiguration(config);
  }

  async start(): Promise<WalletContext> {
    logger.log('Creating wallets...');
    const shieldedWallet = createShieldedWallet(this.#walletConfig, this.#keys.shieldedSecretKeys);
    const dustWallet = createDustWallet(this.#walletConfig, this.#keys.dustSecretKey);
    const unshieldedWallet = createUnshieldedWallet(this.#walletConfig, this.#keys.unshieldedKeystore);

    const walletFacade = new WalletFacade(shieldedWallet, unshieldedWallet, dustWallet);
    const walletProvider = new DustWalletProvider(
      walletFacade.dust,
      this.#keys.shieldedSecretKeys,
      this.#keys.dustSecretKey
    );

    logger.log('Starting wallet facade...');
    await walletFacade.start(this.#keys.shieldedSecretKeys, this.#keys.dustSecretKey);

    logger.log('Syncing wallets...');
    await Promise.all([walletFacade.shielded.waitForSyncedState(), walletFacade.dust.waitForSyncedState()]);
    logger.log('Wallets synced');

    await saveWalletStates(walletFacade);

    return { walletFacade, walletProvider };
  }
}
