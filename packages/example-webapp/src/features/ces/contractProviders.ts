import type { WalletProvider } from '@midnight-ntwrk/midnight-js-types';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import type { BrowserProviders } from './createBrowserProviders';
import type { NetworkConfig } from '../../config';
import { inMemoryPrivateStateProvider } from '@capacity-exchange/core';

export function buildContractProviders<C extends string>(
  providers: BrowserProviders,
  walletProvider: WalletProvider,
  zkConfigPath: string,
  config: NetworkConfig
) {
  const zkConfigProvider = new FetchZkConfigProvider<C>(window.location.origin + zkConfigPath, fetch.bind(window));

  const contractProviders = {
    midnightProvider: providers.midnightProvider,
    privateStateProvider: inMemoryPrivateStateProvider(),
    proofProvider: httpClientProofProvider(config.proofServerUrl, zkConfigProvider),
    publicDataProvider: indexerPublicDataProvider(config.indexerUrl, config.indexerWsUrl),
    walletProvider,
    zkConfigProvider,
  };

  return { contractProviders, zkConfigProvider };
}
