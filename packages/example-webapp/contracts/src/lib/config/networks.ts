import * as fs from 'fs';
import * as path from 'path';
import { NetworkId } from '@midnight-ntwrk/wallet-sdk-abstractions';
import { parse as parseDotenv } from 'dotenv';
import { parseMnemonic, parseSeedHex } from './seed.js';
import type { AppConfig } from './types.js';

interface NetworkDefaults {
  nodeUrl: string;
  proofServerUrl: string;
  indexerHttpUrl: string;
  indexerWsUrl: string;
}

const NETWORK_DEFAULTS: Record<string, NetworkDefaults> = {
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

function toNetworkIdEnum(networkId: string): NetworkId.NetworkId {
  const mapping: Record<string, NetworkId.NetworkId> = {
    undeployed: NetworkId.NetworkId.Undeployed,
    preview: NetworkId.NetworkId.Preview,
    preprod: NetworkId.NetworkId.PreProd,
    testnet: NetworkId.NetworkId.TestNet,
    mainnet: NetworkId.NetworkId.MainNet,
  };
  const enumValue = mapping[networkId];
  if (!enumValue) {
    throw new Error(`Unknown network ID: ${networkId}. Known networks: ${Object.keys(mapping).join(', ')}`);
  }
  return enumValue;
}

function findPackageRoot(from: string): string {
  let dir = from;
  while (true) {
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error('Could not find package.json');
    }
    dir = parent;
  }
}

function loadDotEnv(): Record<string, string> {
  const envPath = path.join(findPackageRoot(import.meta.dirname), '.env');
  if (!fs.existsSync(envPath)) {
    return {};
  }
  const content = fs.readFileSync(envPath, 'utf-8');
  return parseDotenv(content);
}

function resolveWalletSeed(dotEnv: Record<string, string>, networkId: string): Buffer {
  const prefix = networkId.toUpperCase();
  const seedHex = dotEnv[`${prefix}_SEED_HEX`];
  const mnemonic = dotEnv[`${prefix}_MNEMONIC`];

  if (seedHex && mnemonic) {
    throw new Error(`Set exactly one of ${prefix}_SEED_HEX or ${prefix}_MNEMONIC in .env, not both`);
  }
  if (mnemonic) {
    return parseMnemonic(mnemonic);
  }
  if (seedHex) {
    return parseSeedHex(seedHex);
  }
  throw new Error(`Missing ${prefix}_SEED_HEX or ${prefix}_MNEMONIC in .env`);
}

export function getAppConfigById(networkId: string): AppConfig {
  const defaults = NETWORK_DEFAULTS[networkId];
  if (!defaults) {
    throw new Error(`Unknown network ID: ${networkId}. Known networks: ${Object.keys(NETWORK_DEFAULTS).join(', ')}`);
  }

  const dotEnv = loadDotEnv();
  const seed = resolveWalletSeed(dotEnv, networkId);
  return { networkId: toNetworkIdEnum(networkId), ...defaults, seed };
}
