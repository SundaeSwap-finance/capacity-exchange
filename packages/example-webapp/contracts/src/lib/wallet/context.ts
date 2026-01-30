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

export interface WalletContext {
  walletFacade: WalletFacade;
  walletProvider: DustWalletProvider;
}

export class WalletContextStarter implements Startable<WalletContext> {
  #keys: WalletKeys;
  #walletFacade: WalletFacade;
  #walletProvider: DustWalletProvider;

  constructor(config: NetworkConfig, seedHex: string) {
    this.#keys = deriveWalletKeys(seedHex, config.networkId);
    const walletConfig = createWalletConfiguration(config);

    const dustWallet = DustWallet(walletConfig).startWithSecretKey(this.#keys.dustSecretKey, DUST_PARAMS);
    const shieldedWallet = ShieldedWallet(walletConfig).startWithSecretKeys(this.#keys.shieldedSecretKeys);
    const unshieldedWallet = UnshieldedWallet({
      ...walletConfig,
      txHistoryStorage: new InMemoryTransactionHistoryStorage(),
    }).startWithPublicKey(PublicKey.fromKeyStore(this.#keys.unshieldedKeystore));

    this.#walletFacade = new WalletFacade(shieldedWallet, unshieldedWallet, dustWallet);
    this.#walletProvider = new DustWalletProvider(
      this.#walletFacade.dust,
      this.#keys.shieldedSecretKeys,
      this.#keys.dustSecretKey,
    );
  }

  async start(): Promise<WalletContext> {
    console.error('Starting wallet facade...');
    await this.#walletFacade.start(this.#keys.shieldedSecretKeys, this.#keys.dustSecretKey);
    console.error('Syncing wallets...');
    await Promise.all([this.#walletFacade.shielded.waitForSyncedState(), this.#walletFacade.dust.waitForSyncedState()]);
    console.error('Wallets synced');

    return {
      walletFacade: this.#walletFacade,
      walletProvider: this.#walletProvider,
    };
  }
}
