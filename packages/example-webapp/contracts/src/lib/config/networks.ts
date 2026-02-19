import * as fs from 'fs';
import * as path from 'path';
import { parse as parseDotenv } from 'dotenv';
import { resolveEndpoints, toNetworkIdEnum, parseMnemonic, parseSeedHex } from '@capacity-exchange/core';
import type { NetworkId } from '@midnight-ntwrk/wallet-sdk-abstractions';
import type { NetworkEndpoints } from '@capacity-exchange/core';

export interface AppConfig {
  networkId: NetworkId.NetworkId;
  endpoints: NetworkEndpoints;
  seed: Uint8Array;
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

function resolveWalletSeed(dotEnv: Record<string, string>, networkId: string): Uint8Array {
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

export function getAppConfigById(network: string): AppConfig {
  const networkId = toNetworkIdEnum(network);
  const endpoints = resolveEndpoints(networkId);
  const dotEnv = loadDotEnv();
  const seed = resolveWalletSeed(dotEnv, network);
  return { networkId, endpoints, seed };
}
