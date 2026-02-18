import { NETWORK_ENDPOINTS, type NetworkEndpoints } from '@capacity-exchange/core';
import type { NetworkId as MidnightNetworkId } from '@midnight-ntwrk/wallet-sdk-abstractions';

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
  const defaults: NetworkEndpoints | undefined = NETWORK_ENDPOINTS[networkId as MidnightNetworkId.NetworkId];
  if (!defaults) {
    throw new Error(`Unknown network: ${networkId}`);
  }

  // Route through Vite dev proxy to avoid CORS on the indexer HTTP endpoint.
  const indexerUrl = `${window.location.origin}/proxy/${networkId}/indexer/api/v3/graphql`;

  return {
    networkId,
    indexerUrl,
    indexerWsUrl: defaults.indexerWsUrl,
    proofServerUrl: defaults.proofServerUrl,
    nodeWsUrl: defaults.nodeUrl,
    capacityExchangeUrl: requireEnv('VITE_CAPACITY_EXCHANGE_URL'),
  };
}

export const NETWORK_CONFIGS: Record<string, NetworkConfig> = Object.fromEntries(
  Object.keys(NETWORK_ENDPOINTS).map((id) => [id, buildNetworkConfig(id)])
);

export type NetworkId = keyof typeof NETWORK_CONFIGS;
