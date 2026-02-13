import { createHash } from 'crypto';
import {
  createAndSyncWallet,
  COST_PARAMS,
  DustWalletProvider,
  uint8ArrayToHex,
  type WalletKeys,
  type CreateAndSyncWalletOptions,
} from '@capacity-exchange/core';
import type { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import type { AppConfig } from '../config/networks.js';
import { clearWalletState, loadWalletState, saveWalletState } from './storage.js';
import { createLogger } from '../logger.js';

const logger = createLogger(import.meta);

export interface WalletContext {
  walletFacade: WalletFacade;
  walletProvider: DustWalletProvider;
  keys: WalletKeys;
}

function stateSuffix(networkId: string, seedHex: string): string {
  return createHash('sha256')
    .update(networkId + seedHex)
    .digest('hex')
    .slice(0, 12);
}

async function saveWalletStates(facade: WalletFacade, suffix: string): Promise<void> {
  try {
    const [shieldedState, dustState] = await Promise.all([
      facade.shielded.serializeState(),
      facade.dust.serializeState(),
    ]);
    saveWalletState('shielded', suffix, shieldedState);
    saveWalletState('dust', suffix, dustState);
  } catch {
    logger.log('Failed to save wallet state');
  }
}

async function syncWithRetry(options: CreateAndSyncWalletOptions, suffix: string): Promise<WalletContext> {
  try {
    return await createAndSyncWallet(options);
  } catch (error) {
    if (!options.savedShieldedState && !options.savedDustState) {
      throw error;
    }
    logger.log('Failed with saved state, clearing and retrying fresh...');
    clearWalletState('shielded', suffix);
    clearWalletState('dust', suffix);
    return await createAndSyncWallet({
      ...options,
      savedShieldedState: undefined,
      savedDustState: undefined,
    });
  }
}

export async function createWalletContext(config: AppConfig): Promise<WalletContext> {
  const seedHex = uint8ArrayToHex(config.seed);
  const suffix = stateSuffix(config.networkId, seedHex);

  const walletConfig = {
    networkId: config.networkId,
    costParameters: COST_PARAMS,
    relayURL: new URL(config.nodeUrl),
    provingServerUrl: new URL(config.proofServerUrl),
    indexerClientConnection: {
      indexerHttpUrl: config.indexerHttpUrl,
      indexerWsUrl: config.indexerWsUrl,
    },
  };

  logger.log('Creating and syncing wallets...');
  const result = await syncWithRetry(
    {
      seedHex,
      walletConfig,
      savedShieldedState: loadWalletState('shielded', suffix) ?? undefined,
      savedDustState: loadWalletState('dust', suffix) ?? undefined,
      syncTimeoutMs: 120_000,
    },
    suffix
  );
  logger.log('Wallets synced');

  await saveWalletStates(result.walletFacade, suffix);

  return result;
}
