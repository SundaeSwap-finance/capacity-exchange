import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import {
  withAppContext,
  type AppContext,
  type AppConfig,
} from '@capacity-exchange/midnight-node';
import { toNetworkIdEnum, parseMnemonic, createConnectedAPI } from '@capacity-exchange/midnight-core';
import { loadWalletSeedFromFile } from '@capacity-exchange/midnight-node';
import type { CliConfig } from './config';
import { resolveMnemonic } from './wallet';

/**
 * Build an AppConfig for the CLI, supporting mnemonic from flag/env/prompt
 * in addition to the wallet file approach.
 */
async function resolveAppConfig(config: CliConfig, mnemonicFlag?: string): Promise<AppConfig> {
  const networkId = toNetworkIdEnum(config.networkId);
  const endpoints = config.endpoints;

  let seed: Uint8Array;
  const mnemonicFromEnv = mnemonicFlag ?? process.env.MNEMONIC;

  if (mnemonicFromEnv) {
    seed = parseMnemonic(mnemonicFromEnv.trim());
  } else {
    try {
      seed = loadWalletSeedFromFile(config.networkId);
    } catch {
      seed = await resolveMnemonic(undefined, config.json);
    }
  }

  const walletStateDir = process.env.WALLET_STATE_DIR ?? '.wallet-state';
  const walletSyncTimeoutMs = process.env.WALLET_SYNC_TIMEOUT_MS
    ? Number(process.env.WALLET_SYNC_TIMEOUT_MS)
    : undefined;

  return { networkId, endpoints, seed, walletStateDir, walletSyncTimeoutMs };
}

/**
 * Create a ConnectedAPI from an AppContext.
 */
export function createConnectedAPIFromContext(ctx: AppContext, config: CliConfig): ConnectedAPI {
  return createConnectedAPI(
    { walletFacade: ctx.walletContext.walletFacade, keys: ctx.walletContext.keys },
    config.networkId,
    config.endpoints.proofServerUrl
  );
}

/**
 * Resolve CLI-specific config (mnemonic from flag/env/prompt) then
 * delegate to midnight-node's withAppContext.
 */
export async function withCliContext<T>(
  config: CliConfig,
  mnemonicFlag: string | undefined,
  fn: (ctx: AppContext) => T | Promise<T>
): Promise<T> {
  const appConfig = await resolveAppConfig(config, mnemonicFlag);
  return withAppContext(appConfig, fn);
}
