import * as fs from 'fs';
import * as path from 'path';
import { parse as parseDotenv } from 'dotenv';
import { resolveEndpoints, toNetworkIdEnum, type NetworkEndpoints } from '@capacity-exchange/midnight-core';
import type { NetworkId } from '@midnight-ntwrk/wallet-sdk-abstractions';
import { loadWalletSeed } from './walletFile.js';

export interface AppConfig {
  networkId: NetworkId.NetworkId;
  endpoints: NetworkEndpoints;
  seed: Uint8Array;
  walletStateDir?: string;
  /** Wallet sync timeout in milliseconds. Defaults to 120_000 (2 minutes). */
  walletSyncTimeoutMs?: number;
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
  const dotEnv = loadDotEnv();
  const endpoints = resolveEndpoints(networkId, process.env.PROOF_SERVER_URL ?? dotEnv['PROOF_SERVER_URL']);
  const seed = loadWalletSeed(network);
  const walletStateDir = dotEnv['WALLET_STATE_DIR'] || undefined;
  return { networkId, endpoints, seed, walletStateDir };
}
