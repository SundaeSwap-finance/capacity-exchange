import { NetworkId } from '@midnight-ntwrk/wallet-sdk-abstractions';

// TestNet is defined in the SDK enum but has no public endpoints.
const NETWORK_ID_MAP: Record<string, NetworkId.NetworkId> = {
    undeployed: NetworkId.NetworkId.Undeployed,
    preview: NetworkId.NetworkId.Preview,
    preprod: NetworkId.NetworkId.PreProd,
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

interface NetworkDefaults {
    nodeUrl: string;
    proofServerUrl?: string;
    indexerHttpUrl: string;
    indexerWsUrl: string;
}

const NETWORK_DEFAULTS = new Map<NetworkId.NetworkId, NetworkDefaults>([
    [NetworkId.NetworkId.Undeployed, {
        nodeUrl: 'ws://localhost:9944',
        proofServerUrl: 'http://127.0.0.1:6300',
        indexerHttpUrl: 'http://localhost:8088/api/v3/graphql',
        indexerWsUrl: 'ws://localhost:8088/api/v3/graphql/ws',
    }],
    [NetworkId.NetworkId.Preview, {
        nodeUrl: 'wss://rpc.preview.midnight.network/ws',
        proofServerUrl: 'https://lace-proof-pub.preview.midnight.network',
        indexerHttpUrl: 'https://indexer.preview.midnight.network/api/v3/graphql',
        indexerWsUrl: 'wss://indexer.preview.midnight.network/api/v3/graphql/ws',
    }],
    [NetworkId.NetworkId.PreProd, {
        nodeUrl: 'wss://rpc.preprod.midnight.network/ws',
        indexerHttpUrl: 'https://indexer.preprod.midnight.network/api/v3/graphql',
        indexerWsUrl: 'wss://indexer.preprod.midnight.network/api/v3/graphql/ws',
    }],
    [NetworkId.NetworkId.MainNet, {
        nodeUrl: 'wss://rpc.mainnet.midnight.network/ws',
        indexerHttpUrl: 'https://indexer.mainnet.midnight.network/api/v3/graphql',
        indexerWsUrl: 'wss://indexer.mainnet.midnight.network/api/v3/graphql/ws',
    }],
]);

export function resolveEndpoints(networkId: NetworkId.NetworkId): NetworkEndpoints {
    const defaults = NETWORK_DEFAULTS.get(networkId);
    if (!defaults) {
        throw new Error(`Unsupported network '${networkId}'. Supported: ${[...NETWORK_DEFAULTS.keys()].join(', ')}`);
    }
    if (!defaults.proofServerUrl) {
        throw new Error(`No proof server configured for '${networkId}'. Set PROOF_SERVER_URL in your .env file.`);
    }
    return defaults as NetworkEndpoints;
}
