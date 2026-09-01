import { NetworkId } from '@midnight-ntwrk/wallet-sdk';

// TestNet is defined in the SDK enum but has no public endpoints.
const NETWORK_ID_MAP: Record<string, NetworkId.NetworkId> = {
  undeployed: NetworkId.NetworkId.Undeployed,
  preview: NetworkId.NetworkId.Preview,
  preprod: NetworkId.NetworkId.PreProd,
  mainnet: NetworkId.NetworkId.MainNet,
};

/** The network ids this project supports. */
export const SUPPORTED_NETWORK_IDS = Object.keys(NETWORK_ID_MAP) as readonly string[];

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
  capacityExchangeUrl?: string;
}

interface NetworkDefaults {
  nodeUrl: string;
  proofServerUrl?: string;
  indexerHttpUrl: string;
  indexerWsUrl: string;
  capacityExchangeUrl?: string;
}

const NETWORK_DEFAULTS = new Map<NetworkId.NetworkId, NetworkDefaults>([
  [
    NetworkId.NetworkId.Undeployed,
    {
      nodeUrl: 'ws://localhost:9944',
      proofServerUrl: 'http://127.0.0.1:6300',
      indexerHttpUrl: 'http://localhost:8088/api/v3/graphql',
      indexerWsUrl: 'ws://localhost:8088/api/v3/graphql/ws',
    },
  ],
  [
    NetworkId.NetworkId.Preview,
    {
      nodeUrl: 'wss://rpc.preview.midnight.network/ws',
      proofServerUrl: 'https://proof.capacity-exchange.preview.sundae.fi',
      indexerHttpUrl: 'https://indexer.preview.midnight.network/api/v3/graphql',
      indexerWsUrl: 'wss://indexer.preview.midnight.network/api/v3/graphql/ws',
      capacityExchangeUrl: 'https://capacity-exchange.preview.sundae.fi',
    },
  ],
  [
    NetworkId.NetworkId.PreProd,
    {
      nodeUrl: 'wss://rpc.preprod.midnight.network/ws',
      proofServerUrl: 'https://proof.capacity-exchange.preprod.sundae.fi',
      indexerHttpUrl: 'https://indexer.preprod.midnight.network/api/v3/graphql',
      indexerWsUrl: 'wss://indexer.preprod.midnight.network/api/v3/graphql/ws',
      capacityExchangeUrl: 'https://capacity-exchange.preprod.sundae.fi',
    },
  ],
  [
    NetworkId.NetworkId.MainNet,
    {
      nodeUrl: 'wss://rpc.mainnet.midnight.network/ws',
      indexerHttpUrl: 'https://indexer.mainnet.midnight.network/api/v3/graphql',
      proofServerUrl: 'https://proof.capacity-exchange.sundae.fi',
      indexerWsUrl: 'wss://indexer.mainnet.midnight.network/api/v3/graphql/ws',
      capacityExchangeUrl: 'https://capacity-exchange.sundae.fi',
    },
  ],
]);

export function resolveEndpoints(
  networkId: NetworkId.NetworkId,
  overrides: Partial<NetworkEndpoints> = {}
): NetworkEndpoints {
  const defaults = NETWORK_DEFAULTS.get(networkId);
  if (!defaults) {
    throw new Error(`Unsupported network '${networkId}'. Supported: ${[...NETWORK_DEFAULTS.keys()].join(', ')}`);
  }
  const proofServerUrl = overrides.proofServerUrl ?? defaults.proofServerUrl;
  if (!proofServerUrl) {
    throw new Error(`No proof server configured for '${networkId}'. Set PROOF_SERVER_URL in your .env file.`);
  }
  return {
    nodeUrl: overrides.nodeUrl ?? defaults.nodeUrl,
    proofServerUrl,
    indexerHttpUrl: overrides.indexerHttpUrl ?? defaults.indexerHttpUrl,
    indexerWsUrl: overrides.indexerWsUrl ?? defaults.indexerWsUrl,
    capacityExchangeUrl: overrides.capacityExchangeUrl ?? defaults.capacityExchangeUrl,
  };
}

/** The hosted capacity exchanges to try for a network. Empty for an unknown or unhosted one. */
export function defaultCapacityExchangeUrls(networkId: string): string[] {
  const enumValue = NETWORK_ID_MAP[networkId];
  const url = enumValue === undefined ? undefined : NETWORK_DEFAULTS.get(enumValue)?.capacityExchangeUrl;
  return url ? [url] : [];
}

/** Returns scheme://host for logging, dropping the path, query, and credentials. A secret in
 *  the path or query is removed. One embedded in the host would still appear. */
export function redactUrl(raw: string): string {
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.host}`;
  } catch {
    return '[redacted url]';
  }
}
