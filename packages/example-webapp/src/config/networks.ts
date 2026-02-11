import { config } from './env';

export interface NetworkConfig {
  networkId: string;
  indexerUrl: string;
  indexerWsUrl: string;
  proofServerUrl: string;
  nodeWsUrl: string;
  capacityExchangeUrl: string;
}

const PREVIEW_CONFIG: NetworkConfig = {
  networkId: 'preview',
  indexerUrl: '/proxy/preview-indexer/api/v3/graphql',
  indexerWsUrl: '/proxy/preview-indexer/api/v3/graphql',
  proofServerUrl: '/proxy/preview-prover',
  nodeWsUrl: 'wss://rpc.preview.midnight.network',
  capacityExchangeUrl: 'http://localhost:3000',
};

export const NETWORK_CONFIGS = {
  undeployed: {
    networkId: config.networkId,
    indexerUrl: config.indexerUrl,
    indexerWsUrl: config.indexerWsUrl,
    proofServerUrl: config.proofServerUrl,
    nodeWsUrl: config.nodeWsUrl,
    capacityExchangeUrl: config.capacityExchangeUrl,
  },
  preview: PREVIEW_CONFIG,
} as const;

export type NetworkId = keyof typeof NETWORK_CONFIGS;
