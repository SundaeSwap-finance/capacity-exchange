import { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { ShieldedWallet } from '@midnight-ntwrk/wallet-sdk-shielded';
import {
  UnshieldedWallet,
  InMemoryTransactionHistoryStorage,
  PublicKey,
} from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { NetworkConfig, DUST_PARAMS } from '../config/env.js';
import { Startable } from '../startable.js';
import { DustWalletProvider } from './provider.js';
import { deriveWalletKeys, WalletKeys } from './keys.js';
import { createWalletConfiguration } from './config.js';
import { loadWalletState, saveWalletState } from './storage.js';

export interface WalletContext {
  walletFacade: WalletFacade;
  walletProvider: DustWalletProvider;
}

export class WalletContextStarter implements Startable<WalletContext> {
  #keys: WalletKeys;
  #config: NetworkConfig;
  #walletConfig: ReturnType<typeof createWalletConfiguration>;

  constructor(config: NetworkConfig, seedHex: string) {
    this.#keys = deriveWalletKeys(seedHex, config.networkId);
    this.#config = config;
    this.#walletConfig = createWalletConfiguration(config);
  }

  async start(): Promise<WalletContext> {
    console.error('[WalletContext] Starting wallet facade...');

    // Try to restore from saved state
    const savedShieldedState = loadWalletState('shielded');
    const savedDustState = loadWalletState('dust');

    let shieldedWallet;
    let dustWallet;

    if (savedShieldedState) {
      console.error('[WalletContext] Restoring shielded wallet from saved state...');
      try {
        shieldedWallet = ShieldedWallet(this.#walletConfig).restore(savedShieldedState);
      } catch (error) {
        console.error('[WalletContext] Failed to restore shielded wallet, starting fresh:', error);
        shieldedWallet = ShieldedWallet(this.#walletConfig).startWithSecretKeys(this.#keys.shieldedSecretKeys);
      }
    } else {
      console.error('[WalletContext] Starting fresh shielded wallet...');
      shieldedWallet = ShieldedWallet(this.#walletConfig).startWithSecretKeys(this.#keys.shieldedSecretKeys);
    }

    if (savedDustState) {
      console.error('[WalletContext] Restoring dust wallet from saved state...');
      try {
        dustWallet = DustWallet(this.#walletConfig).restore(savedDustState);
      } catch (error) {
        console.error('[WalletContext] Failed to restore dust wallet, starting fresh:', error);
        dustWallet = DustWallet(this.#walletConfig).startWithSecretKey(this.#keys.dustSecretKey, DUST_PARAMS);
      }
    } else {
      console.error('[WalletContext] Starting fresh dust wallet...');
      dustWallet = DustWallet(this.#walletConfig).startWithSecretKey(this.#keys.dustSecretKey, DUST_PARAMS);
    }

    const unshieldedWallet = UnshieldedWallet({
      ...this.#walletConfig,
      txHistoryStorage: new InMemoryTransactionHistoryStorage(),
    }).startWithPublicKey(PublicKey.fromKeyStore(this.#keys.unshieldedKeystore));

    const walletFacade = new WalletFacade(shieldedWallet, unshieldedWallet, dustWallet);
    const walletProvider = new DustWalletProvider(
      walletFacade.dust,
      this.#keys.shieldedSecretKeys,
      this.#keys.dustSecretKey
    );

    console.error('[WalletContext] Starting wallet facade...');
    await walletFacade.start(this.#keys.shieldedSecretKeys, this.#keys.dustSecretKey);

    console.error('[WalletContext] Syncing wallets...');
    await Promise.all([
      walletFacade.shielded.waitForSyncedState(),
      walletFacade.dust.waitForSyncedState()
    ]);
    console.error('[WalletContext] Wallets synced');

    // Save state for next time
    try {
      const shieldedState = await walletFacade.shielded.serializeState();
      const dustState = await walletFacade.dust.serializeState();
      saveWalletState('shielded', shieldedState);
      saveWalletState('dust', dustState);
    } catch (error) {
      console.error('[WalletContext] Failed to save wallet state:', error);
    }

    return {
      walletFacade,
      walletProvider,
    };
  }
}
