import { resolveEndpoints, requireBrowserEnv, toNetworkIdEnum } from '@capacity-exchange/midnight-core';

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
  capacityExchangeUrl: string;
}

export function resolveNetworkConfig(networkId: string): NetworkConfig {
  const endpoints = resolveEndpoints(toNetworkIdEnum(networkId), import.meta.env.VITE_PROOF_SERVER_URL);

  return {
    networkId,
    indexerUrl: endpoints.indexerHttpUrl,
    indexerWsUrl: endpoints.indexerWsUrl,
    proofServerUrl: endpoints.proofServerUrl,
    nodeWsUrl: endpoints.nodeUrl,
    capacityExchangeUrl: requireBrowserEnv('VITE_CAPACITY_EXCHANGE_URL'),
  };
}
