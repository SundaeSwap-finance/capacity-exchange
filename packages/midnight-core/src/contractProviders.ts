import type { MidnightProvider, WalletProvider, MidnightProviders } from '@midnight-ntwrk/midnight-js-types';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { inMemoryPrivateStateProvider } from './inMemoryPrivateStateProvider.js';

/**
 * Fetch wrapper that rejects HTML responses as 404.
 *
 * SPA hosts (Vite dev, Netlify, nginx, etc.) serve index.html for missing
 * files. FetchZkConfigProvider doesn't validate Content-Type, so HTML bytes
 * get treated as valid ZK key material, causing proof server 400 errors.
 *
 * @see https://github.com/midnightntwrk/midnight-js/issues/536
 */
async function binaryFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init);
  if (!response.ok) {
    return response;
  }
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return response;
  }
  return new Response(null, { status: 404, statusText: 'Not Found' });
}

export interface BrowserProviderConfig {
  indexerUrl: string;
  indexerWsUrl: string;
  proofServerUrl: string;
}

/** Assemble MidnightProviders for browser-based contract interaction. */
export function buildMidnightProviders<CircuitId extends string>(
  walletProvider: WalletProvider,
  midnightProvider: MidnightProvider,
  zkConfigPath: string,
  config: BrowserProviderConfig
): MidnightProviders<CircuitId> {
  const zkConfigProvider = new FetchZkConfigProvider<CircuitId>(window.location.origin + zkConfigPath, binaryFetch);

  return {
    privateStateProvider: inMemoryPrivateStateProvider(),
    publicDataProvider: indexerPublicDataProvider(config.indexerUrl, config.indexerWsUrl),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(config.proofServerUrl, zkConfigProvider),
    walletProvider,
    midnightProvider,
  };
}
