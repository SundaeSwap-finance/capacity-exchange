import type { CardanoNetwork, NetworkConfig } from '@capacity-exchange/core';
import { toBlockfrostNetworkName } from '@capacity-exchange/core';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const VALID_NETWORKS: CardanoNetwork[] = ['mainnet', 'preprod', 'preview'];

function isValidNetwork(value: string): value is CardanoNetwork {
  return (VALID_NETWORKS as string[]).includes(value);
}

function requireNetwork(name: string): CardanoNetwork {
  const value = requireEnv(name);
  if (!isValidNetwork(value)) {
    throw new Error(`Invalid network: ${value}. Must be one of: ${VALID_NETWORKS.join(', ')}`);
  }
  return value;
}

export function getNetworkConfig(): NetworkConfig {
  const network = requireNetwork('CARDANO_NETWORK');
  return {
    network,
    blockfrostNetwork: toBlockfrostNetworkName(network),
    blockfrostProjectId: requireEnv('BLOCKFROST_PROJECT_ID'),
  };
}
