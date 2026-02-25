import * as fs from 'fs';
import * as path from 'path';
import { parse as parseDotenv } from 'dotenv';
import { resolveEndpoints, toNetworkIdEnum, resolveWalletSeed } from './index';
import type { NetworkId } from '@midnight-ntwrk/wallet-sdk-abstractions';
import type { NetworkEndpoints } from './index';

export interface AppConfig {
  networkId: NetworkId.NetworkId;
  endpoints: NetworkEndpoints;
  seed: Uint8Array;
  walletStateDir: string;
}

function loadDotEnv(): Record<string, string> {
  const envPath = path.join(process.cwd(), '.env');
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
