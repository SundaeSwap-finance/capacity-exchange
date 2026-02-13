import * as fs from 'fs';
import * as path from 'path';
import { DustParameters } from '@midnight-ntwrk/ledger-v7';
import { NetworkId } from '@midnight-ntwrk/wallet-sdk-abstractions';
import { parse as parseDotenv } from 'dotenv';

export interface NetworkConfig {
  networkId: NetworkId.NetworkId;
  nodeUrl: string;
  proofServerUrl: string;
  indexerHttpUrl: string;
  indexerWsUrl: string;
}

export interface MidnightConfig extends NetworkConfig {
  walletSeedFile: string;
}

function toNetworkIdEnum(networkId: string): NetworkId.NetworkId {
  const mapping: Record<string, NetworkId.NetworkId> = {
    undeployed: NetworkId.NetworkId.Undeployed,
    preview: NetworkId.NetworkId.Preview,
    testnet: NetworkId.NetworkId.TestNet,
    mainnet: NetworkId.NetworkId.MainNet,
  };
  const enumValue = mapping[networkId];
  if (!enumValue) {
    throw new Error(`Unknown network ID: ${networkId}. Known networks: ${Object.keys(mapping).join(', ')}`);
  }
  return enumValue;
}

function getEnvFilePath(networkId: string): string {
  return path.resolve(import.meta.dirname, '../../../', `.env.${networkId}`);
}

function loadEnvFile(networkId: string): Record<string, string> {
  const envPath = getEnvFilePath(networkId);
  if (!fs.existsSync(envPath)) {
    throw new Error(`Missing .env file for network "${networkId}": ${envPath}`);
  }
  const content = fs.readFileSync(envPath, 'utf-8');
  return parseDotenv(content);
}

function requireFromEnv(env: Record<string, string>, key: string, networkId: string): string {
  const value = env[key];
  if (!value) {
    throw new Error(`Missing ${key} in .env.${networkId}`);
  }
  return value;
}

export function getMidnightConfigById(networkId: string): MidnightConfig {
  const env = loadEnvFile(networkId);
  return {
    networkId: toNetworkIdEnum(networkId),
    nodeUrl: requireFromEnv(env, 'NODE_WS_URL', networkId),
    proofServerUrl: requireFromEnv(env, 'PROOF_SERVER_URL', networkId),
    indexerHttpUrl: requireFromEnv(env, 'INDEXER_URL', networkId),
    indexerWsUrl: requireFromEnv(env, 'INDEXER_WS_URL', networkId),
    walletSeedFile: requireFromEnv(env, 'WALLET_SEED_FILE', networkId),
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
