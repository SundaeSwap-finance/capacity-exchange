import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import {
  ImpureCircuitId,
  MidnightProvider,
  PrivateStateProvider,
  ProofProvider,
  PublicDataProvider,
  ZKConfigProvider,
} from '@midnight-ntwrk/midnight-js-types';
import { MidnightConfig } from './config/env.js';
import { MidnightProviderStarter } from './providers/midnight.js';
import { createPrivateStateProvider } from './providers/private-state.js';
import { Startable } from './startable.js';
import { WalletContext, WalletContextStarter } from './wallet/context.js';

export interface AppContext {
  privateStateProvider: PrivateStateProvider;
  proofProvider: ProofProvider<ImpureCircuitId>;
  publicDataProvider: PublicDataProvider;
  zkConfigProvider: ZKConfigProvider<ImpureCircuitId>;
  midnightProvider: MidnightProvider;
  walletContext: WalletContext;
}

export class AppSetup implements Startable<AppContext> {
  #privateStateProvider: PrivateStateProvider;
  #proofProvider: ProofProvider<ImpureCircuitId>;
  #publicDataProvider: PublicDataProvider;
  #zkConfigProvider: ZKConfigProvider<ImpureCircuitId>;
  #midnightProvider: MidnightProviderStarter;
  #walletContext: WalletContextStarter;

  constructor(seed: Buffer, config: MidnightConfig) {
    const { nodeUrl, proofServerUrl, indexerHttpUrl, indexerWsUrl, privateDataDir } = config;

    this.#privateStateProvider = createPrivateStateProvider();
    this.#proofProvider = httpClientProofProvider(proofServerUrl);
    this.#publicDataProvider = indexerPublicDataProvider(indexerHttpUrl, indexerWsUrl);
    this.#zkConfigProvider = new NodeZkConfigProvider(privateDataDir);
    this.#midnightProvider = new MidnightProviderStarter(nodeUrl);
    this.#walletContext = new WalletContextStarter(config, seed.toString('hex'));
  }

  async start(): Promise<AppContext> {
    const [midnightProvider, walletContext] = await Promise.all([
      this.#midnightProvider.start(),
      this.#walletContext.start(),
    ]);

    return {
      privateStateProvider: this.#privateStateProvider,
      proofProvider: this.#proofProvider,
      publicDataProvider: this.#publicDataProvider,
      zkConfigProvider: this.#zkConfigProvider,
      midnightProvider,
      walletContext,
    };
  }
}
