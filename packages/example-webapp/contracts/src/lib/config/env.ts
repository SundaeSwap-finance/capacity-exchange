import { DustParameters } from '@midnight-ntwrk/ledger-v6';
import { NetworkId } from '@midnight-ntwrk/wallet-sdk-abstractions';

export interface NetworkConfig {
  networkId: NetworkId.NetworkId;
  nodeUrl: string;
  proofServerUrl: string;
  indexerHttpUrl: string;
  indexerWsUrl: string;
}

export interface MidnightConfig extends NetworkConfig {
  privateDataDir: string;
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const VALID_NETWORK_IDS = Object.values(NetworkId.NetworkId);

function isValidNetworkId(value: string): value is NetworkId.NetworkId {
  return (VALID_NETWORK_IDS as string[]).includes(value);
}

function requireNetworkId(name: string): NetworkId.NetworkId {
  const value = requireEnv(name);
  if (!isValidNetworkId(value)) {
    throw new Error(`Invalid network ID: ${value}. Must be one of: ${VALID_NETWORK_IDS.join(', ')}`);
  }
  return value;
}

export function getNetworkConfig(): NetworkConfig {
  return {
    networkId: requireNetworkId('MIDNIGHT_NETWORK'),
    nodeUrl: requireEnv('NODE_WS_URL'),
    proofServerUrl: requireEnv('PROOF_SERVER_URL'),
    indexerHttpUrl: requireEnv('INDEXER_URL'),
    indexerWsUrl: requireEnv('INDEXER_WS_URL'),
  };
}

export function getMidnightConfig(privateDataDir: string): MidnightConfig {
  return {
    ...getNetworkConfig(),
    privateDataDir,
  };
}

// Dust wallet parameters from spec:
// https://github.com/midnightntwrk/midnight-ledger/blob/main/spec/dust.md#initial-dust-parameters
export const DUST_PARAMS = new DustParameters(5_000_000_000n, 8_267n, 3n * 60n * 60n);

// Cost parameters for fee estimation
export const COST_PARAMS = {
  additionalFeeOverhead: 50_000_000_000_000n,
  feeBlocksMargin: 0,
} as const;
