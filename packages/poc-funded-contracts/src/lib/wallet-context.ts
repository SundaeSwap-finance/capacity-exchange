import {
  createAndSyncWallet,
  resolveWalletConfig,
  DustWalletProvider,
  uint8ArrayToHex,
  type WalletKeys,
  type CreateAndSyncWalletOptions,
} from '@capacity-exchange/core';
import { createWalletStateStore, type StateStore } from '@capacity-exchange/core/node';
import type { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import type { AppConfig } from './config.js';
import { createLogger } from './logger.js';

const logger = createLogger(import.meta);

export interface WalletContext {
  walletFacade: WalletFacade;
  walletProvider: DustWalletProvider;
  keys: WalletKeys;
}

async function saveWalletStates(facade: WalletFacade, store: StateStore): Promise<void> {
  try {
    const [shieldedState, dustState] = await Promise.all([
      facade.shielded.serializeState(),
      facade.dust.serializeState(),
    ]);
    await Promise.all([store.save('shielded', shieldedState), store.save('dust', dustState)]);
  } catch {
    logger.info('Failed to save wallet state');
  }
}

async function syncWithRetry(options: CreateAndSyncWalletOptions, store: StateStore): Promise<WalletContext> {
  try {
    return await createAndSyncWallet(options);
  } catch (error) {
    if (!options.savedShieldedState && !options.savedDustState) {
      throw error;
    }
    logger.info('Failed with saved state, clearing and retrying fresh...');
    await store.clearAll();
    return await createAndSyncWallet({
      ...options,
      savedShieldedState: undefined,
      savedDustState: undefined,
    });
  }
}

export async function createWalletContext(config: AppConfig): Promise<WalletContext> {
  const seedHex = uint8ArrayToHex(config.seed);
  const store = createWalletStateStore(config.networkId, seedHex, logger);

  logger.info('Creating and syncing wallets...');
  const [savedShieldedState, savedDustState] = await Promise.all([store.load('shielded'), store.load('dust')]);

  const result = await syncWithRetry(
    {
      seedHex,
      walletConfig: resolveWalletConfig(config.networkId),
      savedShieldedState,
      savedDustState,
      syncTimeoutMs: 120_000,
    },
    store
  );
  logger.info('Wallets synced');

  await saveWalletStates(result.walletFacade, store);

  return result;
}
