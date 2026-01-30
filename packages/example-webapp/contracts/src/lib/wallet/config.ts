import { NetworkId } from '@midnight-ntwrk/wallet-sdk-abstractions';
import { NetworkConfig, COST_PARAMS } from '../config/env.js';

export interface WalletConfiguration {
  networkId: NetworkId.NetworkId;
  costParameters: typeof COST_PARAMS;
  relayURL: URL;
  provingServerUrl: URL;
  indexerClientConnection: {
    indexerHttpUrl: string;
    indexerWsUrl: string;
  };
  indexerUrl: string;
}

export function createWalletConfiguration(config: NetworkConfig): WalletConfiguration {
  return {
    networkId: config.networkId,
    costParameters: COST_PARAMS,
    relayURL: new URL(config.nodeUrl),
    provingServerUrl: new URL(config.proofServerUrl),
    indexerClientConnection: {
      indexerHttpUrl: config.indexerHttpUrl,
      indexerWsUrl: config.indexerWsUrl,
    },
    indexerUrl: config.indexerWsUrl,
  };
}
