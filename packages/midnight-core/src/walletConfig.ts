import type { NetworkId } from '@midnight-ntwrk/wallet-sdk-abstractions';
import { COST_PARAMS } from './params.js';
import { resolveEndpoints, type NetworkEndpoints } from './networks.js';

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

export function resolveWalletConfig(networkId: NetworkId.NetworkId, proofServerUrl?: string): WalletConfig {
  return buildWalletConfig(networkId, resolveEndpoints(networkId, proofServerUrl));
}
