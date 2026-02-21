import type { MidnightProvider, WalletProvider } from '@midnight-ntwrk/midnight-js-types';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import type { NetworkConfig } from '../../config';
import { inMemoryPrivateStateProvider } from '@capacity-exchange/core';

/**
 * Fetch wrapper that rejects HTML responses as 404.
 *
 * SPA hosts (Vite dev, Netlify, nginx, etc.) serve index.html for missing
 * files. FetchZkConfigProvider doesn't validate Content-Type, so HTML bytes
 * get treated as valid ZK key material, causing proof server 400 errors.
 *
 * This wrapper converts HTML responses to 404 so FetchZkConfigProvider's
 * error path handles them correctly.
 *
 * @see https://github.com/midnightntwrk/midnight-js/issues/536
 */
async function binaryFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input.toString();
  console.log('[binaryFetch]', init?.method ?? 'GET', url);
  const response = await fetch(input, init);
  console.log('[binaryFetch] response:', response.status, response.headers.get('content-type'), url);
  if (!response.ok) {
    return response;
  }
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return response;
  }
  console.warn('[binaryFetch] Rejected HTML response for', url);
  return new Response(null, { status: 404, statusText: 'Not Found' });
}

export function buildContractProviders<C extends string>(
  midnightProvider: MidnightProvider,
  walletProvider: WalletProvider,
  zkConfigPath: string,
  config: NetworkConfig
) {
  const zkConfigProvider = new FetchZkConfigProvider<C>(window.location.origin + zkConfigPath, binaryFetch);

  const contractProviders = {
    midnightProvider,
    privateStateProvider: inMemoryPrivateStateProvider(),
    proofProvider: httpClientProofProvider(config.proofServerUrl, zkConfigProvider),
    publicDataProvider: indexerPublicDataProvider(config.indexerUrl, config.indexerWsUrl),
    walletProvider,
    zkConfigProvider,
  };

  return { contractProviders, zkConfigProvider };
}
