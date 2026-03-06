import { NETWORK_ENDPOINTS, requireBrowserEnv, type NetworkEndpoints } from '@capacity-exchange/midnight-core';
import type { NetworkId as MidnightNetworkId } from '@midnight-ntwrk/wallet-sdk-abstractions';

export function requireEnvOneOf(name: string, allowedValues: readonly string[]): string {
  const value = requireBrowserEnv(name);
  if (!allowedValues.includes(value)) {
    throw new Error(`Invalid value "${value}" for ${name}. Must be one of: ${allowedValues.join(', ')}`);
  }
  return value;
}

export interface NetworkConfig {
  networkId: string;
  indexerUrl: string;
  indexerWsUrl: string;
  proofServerUrl: string;
  nodeWsUrl: string;
  // TODO: Make this a list
  capacityExchangeUrl: string;
}

function buildNetworkConfig(networkId: string): NetworkConfig {
  const defaults: NetworkEndpoints | undefined = NETWORK_ENDPOINTS[networkId as MidnightNetworkId.NetworkId];
  if (!defaults) {
    throw new Error(`Unknown network: ${networkId}`);
  }

  return {
    networkId,
    indexerUrl: defaults.indexerHttpUrl,
    indexerWsUrl: defaults.indexerWsUrl,
    proofServerUrl: defaults.proofServerUrl,
    nodeWsUrl: defaults.nodeUrl,
    capacityExchangeUrl: requireBrowserEnv('VITE_CAPACITY_EXCHANGE_URL'),
  };
}

export const NETWORK_CONFIGS: Record<string, NetworkConfig> = Object.fromEntries(
  Object.keys(NETWORK_ENDPOINTS).map((id) => [id, buildNetworkConfig(id)])
);

export type NetworkId = keyof typeof NETWORK_CONFIGS;
