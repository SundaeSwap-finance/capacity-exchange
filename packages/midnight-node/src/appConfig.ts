import * as fs from 'fs';
import * as path from 'path';
import { parse as parseDotenv } from 'dotenv';
import { resolveEndpoints, toNetworkIdEnum, type NetworkEndpoints } from '@sundaeswap/capacity-exchange-core';
import type { NetworkId } from '@midnight-ntwrk/wallet-sdk-abstractions';
import { loadWalletSeedFromEnv, type Env } from './walletFile.js';

export interface NetworkConfig {
  networkId: NetworkId.NetworkId;
  endpoints: NetworkEndpoints;
}

export interface WalletConfig {
  seed: Uint8Array;
  walletStateDir: string;
  /** Wallet sync timeout in milliseconds. Defaults to 120_000 (2 minutes). */
  walletSyncTimeoutMs?: number;
}

export interface AppConfig {
  network: NetworkConfig;
  wallet: WalletConfig;
}

/** Merges process.env with .env files. process.env wins. */
function resolveEnv(): Env {
  const envPath = path.join(process.cwd(), '.env');
  const dotEnv: Record<string, string> = fs.existsSync(envPath) ? parseDotenv(fs.readFileSync(envPath, 'utf-8')) : {};
  return { ...dotEnv, ...process.env };
}

export function buildNetworkConfig(network: string, env: Env): NetworkConfig {
  const networkId = toNetworkIdEnum(network);
  const endpoints = resolveEndpoints(networkId, env.PROOF_SERVER_URL);
  return { networkId, endpoints };
}

/** Requires one of WALLET_SEED_FILE WALLET_MNEMONIC_FILE plus WALLET_STATE_DIR. */
export function buildWalletConfig(env: Env): WalletConfig {
  const seed = loadWalletSeedFromEnv(env);
  const walletStateDir = env.WALLET_STATE_DIR;
  if (!walletStateDir) {
    throw new Error('WALLET_STATE_DIR is required');
  }
  const walletSyncTimeoutMs = env.WALLET_SYNC_TIMEOUT_MS ? Number(env.WALLET_SYNC_TIMEOUT_MS) : undefined;
  return { seed, walletStateDir, walletSyncTimeoutMs };
}

export function buildAppConfig(network: string, env: Env): AppConfig {
  return { network: buildNetworkConfig(network, env), wallet: buildWalletConfig(env) };
}

/** Builds app config from process.env and .env.*/
export function getAppConfigFromEnv(network: string): AppConfig {
  return buildAppConfig(network, resolveEnv());
}
