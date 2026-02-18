import type { NetworkId } from '@midnight-ntwrk/wallet-sdk-abstractions';
import { COST_PARAMS } from './params';
import { NETWORK_ENDPOINTS, type NetworkEndpoints } from './networks';

export interface WalletConfig {
  networkId: NetworkId.NetworkId;
  costParameters: typeof COST_PARAMS;
  relayURL: URL;
  provingServerUrl: URL;
  indexerClientConnection: {
    indexerHttpUrl: string;
    indexerWsUrl: string;
  };
}

function buildWalletConfig(networkId: NetworkId.NetworkId, endpoints: NetworkEndpoints): WalletConfig {
  return {
    networkId,
    costParameters: COST_PARAMS,
    relayURL: new URL(endpoints.nodeUrl),
    provingServerUrl: new URL(endpoints.proofServerUrl),
    indexerClientConnection: {
      indexerHttpUrl: endpoints.indexerHttpUrl,
      indexerWsUrl: endpoints.indexerWsUrl,
    },
  };
}

export const WALLET_CONFIGS: Record<NetworkId.NetworkId, WalletConfig> = Object.fromEntries(
  Object.entries(NETWORK_ENDPOINTS).map(([id, endpoints]) => [
    id,
    buildWalletConfig(id as NetworkId.NetworkId, endpoints),
  ])
);

export function resolveWalletConfig(networkId: NetworkId.NetworkId): WalletConfig {
  const config = WALLET_CONFIGS[networkId];
  if (!config) {
    throw new Error(`Unknown network '${networkId}'. Known networks: ${Object.keys(WALLET_CONFIGS).join(', ')}`);
  }
  return config;
}
