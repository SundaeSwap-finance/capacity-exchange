import type { WalletProvider } from '@midnight-ntwrk/midnight-js-types';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import type { BrowserProviders } from './createBrowserProviders';
import { config } from '../../config';
import { noopPrivateStateProvider } from '../../utils/noopPrivateStateProvider';

export function buildContractProviders<C extends string>(
  providers: BrowserProviders,
  walletProvider: WalletProvider,
  zkConfigPath: string
) {
  const zkConfigProvider = new FetchZkConfigProvider<C>(window.location.origin + zkConfigPath, fetch.bind(window));

  const contractProviders = {
    midnightProvider: providers.midnightProvider,
    privateStateProvider: noopPrivateStateProvider(),
    proofProvider: providers.proofProvider,
    publicDataProvider: indexerPublicDataProvider(config.indexerUrl, config.indexerWsUrl),
    walletProvider,
    zkConfigProvider,
  };

  return { contractProviders, zkConfigProvider };
}
