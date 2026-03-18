import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import {
  createAppContext,
  type AppContext,
  type AppConfig,
  createLogger,
} from '@capacity-exchange/midnight-node';
import { toNetworkIdEnum, parseMnemonic, createConnectedAPI } from '@capacity-exchange/midnight-core';
import { loadWalletSeedFromFile } from '@capacity-exchange/midnight-node';
import type { CliConfig } from './config';
import { resolveMnemonic } from './wallet';
import { isJsonMode } from './output';

const logger = createLogger(import.meta);

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
      seed = await resolveMnemonic(undefined, isJsonMode());
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
 * Avoids repeating the walletFacade/keys extraction in every command.
 */
export function createConnectedAPIFromContext(ctx: AppContext, config: CliConfig): ConnectedAPI {
  return createConnectedAPI(
    { walletFacade: ctx.walletContext.walletFacade, keys: ctx.walletContext.keys },
    config.networkId,
    config.endpoints.proofServerUrl
  );
}

/**
 * CLI version of withAppContext that supports flexible mnemonic resolution.
 */
export async function withCliContext<T>(
  config: CliConfig,
  mnemonicFlag: string | undefined,
  fn: (ctx: AppContext) => T | Promise<T>
): Promise<T> {
  const appConfig = await resolveAppConfig(config, mnemonicFlag);
  logger.info(`Network: ${config.networkId}, PID: ${process.pid}`);
  setNetworkId(appConfig.networkId);
  const ctx = await createAppContext(appConfig);
  return fn(ctx);
}
