import {
  createAndSyncWalletWithStore,
  resolveWalletConfig,
  DustWalletProvider,
  uint8ArrayToHex,
  type WalletKeys,
} from '@capacity-exchange/midnight-core';
import { FileStateStore } from './fileStateStore.js';
import { createLogger } from './createLogger.js';
import type { AppConfig } from './appConfig.js';
import type { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';

const logger = createLogger(import.meta);

export interface WalletContext {
  walletFacade: WalletFacade;
  walletProvider: DustWalletProvider;
  keys: WalletKeys;
}

export async function createWalletContext(config: AppConfig): Promise<WalletContext> {
  const seedHex = uint8ArrayToHex(config.seed);
  const store = new FileStateStore(config.walletStateDir, logger);

  logger.info('Creating and syncing wallets...');
  const result = await createAndSyncWalletWithStore(
    {
      seedHex,
      walletConfig: resolveWalletConfig(config.networkId, config.endpoints.proofServerUrl),
      syncTimeoutMs: 120_000,
    },
    store
  );
  logger.info('Wallets synced');

  return result;
}
