import * as fs from 'fs';
import * as path from 'path';
import { parse as parseDotenv } from 'dotenv';
import { resolveEndpoints, toNetworkIdEnum, resolveWalletSeed } from '@capacity-exchange/core';
import type { NetworkId } from '@midnight-ntwrk/wallet-sdk-abstractions';
import type { NetworkEndpoints } from '@capacity-exchange/core';

export interface AppConfig {
  networkId: NetworkId.NetworkId;
  endpoints: NetworkEndpoints;
  seed: Uint8Array;
  walletStateDir: string;
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

export function getAppConfigById(network: string): AppConfig {
  const networkId = toNetworkIdEnum(network);
  const endpoints = resolveEndpoints(networkId);
  const dotEnv = loadDotEnv();
  const seed = resolveWalletSeed(dotEnv, network.toUpperCase());
  const walletStateDir = dotEnv['WALLET_STATE_DIR'];
  if (!walletStateDir) {
    throw new Error('Missing WALLET_STATE_DIR in .env');
  }
  return { networkId, endpoints, seed, walletStateDir };
}
