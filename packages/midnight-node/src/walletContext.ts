import {
  createAndSyncWalletWithStore,
  resolveWalletConfig,
  DustWalletProvider,
  uint8ArrayToHex,
  type WalletKeys,
} from '@sundaeswap/capacity-exchange-core';
import { FileStateStore } from './fileStateStore.js';
import { createLogger } from './createLogger.js';
import type { AppConfig } from './appConfig.js';
import type { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';

const logger = createLogger(import.meta);

// TODO: Remove WalletContext — use WalletConnection directly and construct DustWalletProvider at call sites
export interface WalletContext {
  walletFacade: WalletFacade;
  walletProvider: DustWalletProvider;
  keys: WalletKeys;
}

export async function createWalletContext(config: AppConfig): Promise<WalletContext> {
  const seedHex = uint8ArrayToHex(config.wallet.seed);
  const store = new FileStateStore(config.wallet.walletStateDir, logger);
  const timeoutMs = config.wallet.walletSyncTimeoutMs ?? 120_000;

  const walletConfig = resolveWalletConfig(config.network.networkId, config.network.endpoints.proofServerUrl);
  logger.info('Creating and syncing wallets...');
  let walletFacade: WalletFacade;
  let keys: WalletKeys;
  try {
    ({ walletFacade, keys } = await createAndSyncWalletWithStore({ seedHex, walletConfig }, store, timeoutMs));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const endpoints = config.network.endpoints;
    throw new Error(
      `Wallet sync failed: ${msg}\n` +
        `  node:       ${endpoints.nodeUrl}\n` +
        `  indexer:    ${endpoints.indexerHttpUrl}\n` +
        `  proofServer: ${endpoints.proofServerUrl}`
    );
  }
  logger.info('Wallets synced');

  const walletProvider = new DustWalletProvider(walletFacade, keys.shieldedSecretKeys, keys.dustSecretKey);

  return { walletFacade, walletProvider, keys };
}
