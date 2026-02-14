import { NetworkId } from '@midnight-ntwrk/wallet-sdk-abstractions';

const NETWORK_ID_MAP: Record<string, NetworkId.NetworkId> = {
  undeployed: NetworkId.NetworkId.Undeployed,
  preview: NetworkId.NetworkId.Preview,
  preprod: NetworkId.NetworkId.PreProd,
  testnet: NetworkId.NetworkId.TestNet,
  mainnet: NetworkId.NetworkId.MainNet,
};

export function toNetworkIdEnum(networkId: string): NetworkId.NetworkId {
  const enumValue = NETWORK_ID_MAP[networkId];
  if (!enumValue) {
    throw new Error(`Unknown network ID: ${networkId}. Known networks: ${Object.keys(NETWORK_ID_MAP).join(', ')}`);
  }
  return enumValue;
}

export interface NetworkEndpoints {
  nodeUrl: string;
  proofServerUrl: string;
  indexerHttpUrl: string;
  indexerWsUrl: string;
}

export const NETWORK_ENDPOINTS: Record<string, NetworkEndpoints> = {
  undeployed: {
    nodeUrl: 'ws://localhost:9944',
    proofServerUrl: 'http://127.0.0.1:6300',
    indexerHttpUrl: 'http://localhost:8088/api/v3/graphql',
    indexerWsUrl: 'ws://localhost:8088/api/v3/graphql/ws',
  },
  preview: {
    nodeUrl: 'wss://rpc.preview.midnight.network/ws',
    proofServerUrl: 'http://127.0.0.1:6300',
    indexerHttpUrl: 'https://indexer.preview.midnight.network/api/v3/graphql',
    indexerWsUrl: 'wss://indexer.preview.midnight.network/api/v3/graphql/ws',
  },
  preprod: {
    nodeUrl: 'wss://rpc.preprod.midnight.network/ws',
    proofServerUrl: 'http://127.0.0.1:6300',
    indexerHttpUrl: 'https://indexer.preprod.midnight.network/api/v3/graphql',
    indexerWsUrl: 'wss://indexer.preprod.midnight.network/api/v3/graphql/ws',
  },
  testnet: {
    nodeUrl: 'wss://rpc.testnet.midnight.network/ws',
    proofServerUrl: 'http://127.0.0.1:6300',
    indexerHttpUrl: 'https://indexer.testnet.midnight.network/api/v3/graphql',
    indexerWsUrl: 'wss://indexer.testnet.midnight.network/api/v3/graphql/ws',
  },
  mainnet: {
    nodeUrl: 'wss://rpc.mainnet.midnight.network/ws',
    proofServerUrl: 'http://127.0.0.1:6300',
    indexerHttpUrl: 'https://indexer.mainnet.midnight.network/api/v3/graphql',
    indexerWsUrl: 'wss://indexer.mainnet.midnight.network/api/v3/graphql/ws',
  },
};
