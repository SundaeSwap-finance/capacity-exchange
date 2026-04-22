import * as fs from 'fs';
import * as path from 'path';
import { parse as parseDotenv } from 'dotenv';
import {
  parsePositiveNumber,
  resolveEndpoints,
  toNetworkIdEnum,
  type NetworkEndpoints,
  type ChainSnapshot,
} from '@sundaeswap/capacity-exchange-core';
import type { NetworkId } from '@midnight-ntwrk/wallet-sdk-abstractions';
import type { Env } from './env.js';
import { loadWalletSeedFromEnv } from './walletFile.js';

export interface NetworkConfig {
  networkName: string;
  networkId: NetworkId.NetworkId;
  endpoints: NetworkEndpoints;
}

/** Where wallet state should come from
 *  - `inMemory`: in-memory only. Optionally primed from a chain snapshot.
 *  - `onDisk`: disk-backed via `walletStateDir`. State loads from and saves to disk. */
export type WalletStateSource =
  | { kind: 'inMemory'; chainSnapshot?: ChainSnapshot }
  | { kind: 'onDisk'; walletStateDir: string };

export interface WalletConfig {
  seed: Uint8Array;
  stateSource: WalletStateSource;
  /** Wallet sync timeout in milliseconds. Defaults to 120_000 (2 minutes). */
  walletSyncTimeoutMs?: number;
}

export interface AppConfig {
  network: NetworkConfig;
  wallet: WalletConfig;
}

/** Merges process.env with .env files. process.env wins. */
export function resolveEnv(): Env {
  const envPath = path.join(process.cwd(), '.env');
  const dotEnv: Record<string, string> = fs.existsSync(envPath) ? parseDotenv(fs.readFileSync(envPath, 'utf-8')) : {};
  return { ...dotEnv, ...process.env };
}

export function buildNetworkConfig(networkName: string, env: Env): NetworkConfig {
  const networkId = toNetworkIdEnum(networkName);
  const endpoints = resolveEndpoints(networkId, env.PROOF_SERVER_URL);
  return { networkName, networkId, endpoints };
}

/** Reads WALLET_SYNC_TIMEOUT_MS from env, returning undefined if unset. */
export function readWalletSyncTimeoutMs(env: Env): number | undefined {
  return env.WALLET_SYNC_TIMEOUT_MS
    ? parsePositiveNumber('WALLET_SYNC_TIMEOUT_MS', env.WALLET_SYNC_TIMEOUT_MS)
    : undefined;
}

/** Builds an on-disk WalletStateSource from env. Requires WALLET_STATE_DIR. */
export function onDiskStateSourceFromEnv(env: Env): WalletStateSource {
  const walletStateDir = env.WALLET_STATE_DIR;
  if (!walletStateDir) {
    throw new Error('WALLET_STATE_DIR is required');
  }
  return { kind: 'onDisk', walletStateDir };
}

/** Requires one of WALLET_SEED_FILE / WALLET_MNEMONIC_FILE plus WALLET_STATE_DIR. Builds an on-disk WalletConfig. */
export function buildWalletConfig(env: Env): WalletConfig {
  return {
    seed: loadWalletSeedFromEnv(env),
    stateSource: onDiskStateSourceFromEnv(env),
    walletSyncTimeoutMs: readWalletSyncTimeoutMs(env),
  };
}

export function buildAppConfig(network: string, env: Env): AppConfig {
  return { network: buildNetworkConfig(network, env), wallet: buildWalletConfig(env) };
}
