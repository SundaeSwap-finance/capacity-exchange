import { resolveEndpoints, toNetworkIdEnum } from '@sundaeswap/capacity-exchange-core';
import type { AppConfig } from './appConfig';

export interface NetworkConfig {
  networkId: string;
  indexerUrl: string;
  indexerWsUrl: string;
  proofServerUrl: string;
  nodeWsUrl: string;
  capacityExchangeUrl: string;
}

export function resolveNetworkConfig({ networkId, capacityExchangeUrl, proofServerUrl }: AppConfig): NetworkConfig {
  const endpoints = resolveEndpoints(toNetworkIdEnum(networkId), { capacityExchangeUrl, proofServerUrl });
  if (!endpoints.capacityExchangeUrl) {
    throw new Error(
      `No capacity exchange configured for '${networkId}'. Set CAPACITY_EXCHANGE_URL for the dev server.`
    );
  }

  return {
    networkId,
    indexerUrl: endpoints.indexerHttpUrl,
    indexerWsUrl: endpoints.indexerWsUrl,
    proofServerUrl: endpoints.proofServerUrl,
    nodeWsUrl: endpoints.nodeUrl,
    capacityExchangeUrl: endpoints.capacityExchangeUrl,
  };
}
