import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { MidnightProvider, PrivateStateProvider, PublicDataProvider } from '@midnight-ntwrk/midnight-js-types';
import { MidnightConfig } from './config/env.js';
import { MidnightProviderStarter } from './providers/midnight.js';
import { createPrivateStateProvider } from './providers/private-state.js';
import { Startable } from './startable.js';
import { WalletContext, WalletContextStarter } from './wallet/context.js';

export interface AppContext {
  privateStateProvider: PrivateStateProvider;
  publicDataProvider: PublicDataProvider;
  midnightProvider: MidnightProvider;
  walletContext: WalletContext;
  proofServerUrl: string;
}

export class AppSetup implements Startable<AppContext> {
  #privateStateProvider: PrivateStateProvider;
  #publicDataProvider: PublicDataProvider;
  #midnightProvider: MidnightProviderStarter;
  #walletContext: WalletContextStarter;
  #proofServerUrl: string;

  constructor(seed: Buffer, config: MidnightConfig) {
    const { nodeUrl, proofServerUrl, indexerHttpUrl, indexerWsUrl } = config;

    this.#privateStateProvider = createPrivateStateProvider();
    this.#publicDataProvider = indexerPublicDataProvider(indexerHttpUrl, indexerWsUrl);
    this.#midnightProvider = new MidnightProviderStarter(nodeUrl);
    this.#walletContext = new WalletContextStarter(config, seed.toString('hex'));
    this.#proofServerUrl = proofServerUrl;
  }

  async start(): Promise<AppContext> {
    const [midnightProvider, walletContext] = await Promise.all([
      this.#midnightProvider.start(),
      this.#walletContext.start(),
    ]);

    return {
      privateStateProvider: this.#privateStateProvider,
      publicDataProvider: this.#publicDataProvider,
      midnightProvider,
      walletContext,
      proofServerUrl: this.#proofServerUrl,
    };
  }
}
