import './graphqlFirst.js';
import type { MidnightProvider, WalletProvider, MidnightProviders } from '@midnight-ntwrk/midnight-js/types';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { inMemoryPrivateStateProvider } from './inMemoryPrivateStateProvider.js';

export interface BrowserProviderConfig {
  networkId: string;
  indexerUrl: string;
  indexerWsUrl: string;
  proofServerUrl: string;
  /** How long built transactions stay valid. Defaults to {@link DEFAULT_TX_TTL_SECONDS}. */
  ttlSeconds?: number;
}

/** Default lifetime of transactions built through midnight-js. */
export const DEFAULT_TX_TTL_SECONDS = 5 * 60;

/** Assemble MidnightProviders for browser-based contract interaction. */
export function buildMidnightProviders<CircuitId extends string>(
  walletProvider: WalletProvider,
  midnightProvider: MidnightProvider,
  zkConfigPath: string,
  config: BrowserProviderConfig
): MidnightProviders<CircuitId> & { dispose: () => Promise<void> } {
  // FetchZkConfigProvider rejects SPA index.html fallbacks and checks artifacts against the
  // compiler's integrity manifest, so missing or stale artifacts fail here rather than at the prover.
  const zkConfigProvider = new FetchZkConfigProvider<CircuitId>(window.location.origin + zkConfigPath);
  const publicDataProvider = indexerPublicDataProvider({
    queryURL: config.indexerUrl,
    subscriptionURL: config.indexerWsUrl,
  });

  return {
    privateStateProvider: inMemoryPrivateStateProvider(),
    publicDataProvider,
    zkConfigProvider,
    proofProvider: httpClientProofProvider({
      url: config.proofServerUrl,
      zkConfigProvider,
    }),
    walletProvider,
    midnightProvider,
    config: { networkId: config.networkId, ttlSeconds: config.ttlSeconds ?? DEFAULT_TX_TTL_SECONDS },
    dispose: () => publicDataProvider.dispose(),
  };
}
