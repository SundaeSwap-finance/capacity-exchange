import { NETWORK_ENDPOINTS } from '@capacity-exchange/core';

function requireEnv(name: string): string {
  const value = import.meta.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export interface NetworkConfig {
  networkId: string;
  indexerUrl: string;
  indexerWsUrl: string;
  proofServerUrl: string;
  nodeWsUrl: string;
  capacityExchangeUrl: string;
}

function buildNetworkConfig(networkId: string): NetworkConfig {
  const defaults = NETWORK_ENDPOINTS[networkId];
  if (!defaults) {
    throw new Error(`Unknown network: ${networkId}`);
  }
  return {
    networkId,
    indexerUrl: defaults.indexerHttpUrl,
    indexerWsUrl: defaults.indexerWsUrl,
    proofServerUrl: defaults.proofServerUrl,
    nodeWsUrl: defaults.nodeUrl,
    capacityExchangeUrl: requireEnv('VITE_CAPACITY_EXCHANGE_URL'),
  };
}

// In dev mode, route preview network traffic through the Vite proxy to avoid CORS issues.
const DEV_PREVIEW_OVERRIDES: Partial<NetworkConfig> = {
  indexerUrl: '/proxy/preview-indexer/api/v3/graphql',
  indexerWsUrl: '/proxy/preview-indexer/api/v3/graphql',
  proofServerUrl: '/proxy/preview-prover',
};

export const NETWORK_CONFIGS: Record<string, NetworkConfig> = Object.fromEntries(
  Object.keys(NETWORK_ENDPOINTS).map((id) => {
    const base = buildNetworkConfig(id);
    if (id === 'preview' && import.meta.env.DEV) {
      return [id, { ...base, ...DEV_PREVIEW_OVERRIDES }];
    }
    return [id, base];
  })
);

export type NetworkId = keyof typeof NETWORK_CONFIGS;
