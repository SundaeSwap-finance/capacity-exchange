import { NetworkId } from '@midnight-ntwrk/wallet-sdk-abstractions';
import type { AppConfig } from '../config/types.js';
import { COST_PARAMS } from '../config/params.js';

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

export function createWalletConfiguration(config: AppConfig): WalletConfiguration {
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
