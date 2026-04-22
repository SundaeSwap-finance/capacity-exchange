import {
  buildSyntheticWalletState,
  createAndSyncWallet,
  createAndSyncWalletWithStore,
  deriveWalletKeys,
  resolveWalletConfig,
  DustWalletProvider,
  uint8ArrayToHex,
  type ChainSnapshot,
  type NetworkEndpoints,
  type SavedWalletState,
  type WalletConfig as SdkWalletConfig,
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

interface SyncedWallet {
  walletFacade: WalletFacade;
  keys: WalletKeys;
}

/** Creates an in-memory wallet, optionally primed from a chain snapshot. Does not persist. */
async function syncInMemoryWallet(
  seedHex: string,
  walletConfig: SdkWalletConfig,
  chainSnapshot: ChainSnapshot | undefined,
  timeoutMs: number
): Promise<SyncedWallet> {
  const saved: SavedWalletState = chainSnapshot
    ? buildSyntheticWalletState(
        chainSnapshot,
        deriveWalletKeys(seedHex, walletConfig.networkId),
        String(walletConfig.networkId)
      )
    : {};
  return createAndSyncWallet({ seedHex, walletConfig, ...saved }, timeoutMs);
}

/** Creates an on-disk wallet backed by `walletStateDir`. State loads from and writes to disk across runs. */
async function syncOnDiskWallet(
  seedHex: string,
  walletConfig: SdkWalletConfig,
  walletStateDir: string,
  timeoutMs: number
): Promise<SyncedWallet> {
  const store = new FileStateStore(walletStateDir, logger);
  return createAndSyncWalletWithStore({ seedHex, walletConfig }, store, timeoutMs);
}

/** Wraps a wallet sync failure with the endpoints used, to aid diagnosis. */
function wrapSyncError(err: unknown, endpoints: NetworkEndpoints): Error {
  const msg = err instanceof Error ? err.message : String(err);
  return new Error(
    `Wallet sync failed: ${msg}\n` +
      `  node:       ${endpoints.nodeUrl}\n` +
      `  indexer:    ${endpoints.indexerHttpUrl}\n` +
      `  proofServer: ${endpoints.proofServerUrl}`
  );
}

async function syncWallet(
  seedHex: string,
  walletConfig: SdkWalletConfig,
  source: AppConfig['wallet']['stateSource'],
  timeoutMs: number
): Promise<SyncedWallet> {
  switch (source.kind) {
    case 'inMemory':
      return syncInMemoryWallet(seedHex, walletConfig, source.chainSnapshot, timeoutMs);
    case 'onDisk':
      return syncOnDiskWallet(seedHex, walletConfig, source.walletStateDir, timeoutMs);
  }
}

export async function createWalletContext(config: AppConfig): Promise<WalletContext> {
  const seedHex = uint8ArrayToHex(config.wallet.seed);
  const timeoutMs = config.wallet.walletSyncTimeoutMs ?? 120_000;
  const walletConfig = resolveWalletConfig(config.network.networkId, config.network.endpoints.proofServerUrl);

  logger.info('Creating and syncing wallets...');
  let synced: SyncedWallet;
  try {
    synced = await syncWallet(seedHex, walletConfig, config.wallet.stateSource, timeoutMs);
  } catch (err) {
    throw wrapSyncError(err, config.network.endpoints);
  }
  logger.info('Wallets synced');

  const { walletFacade, keys } = synced;
  const walletProvider = new DustWalletProvider(walletFacade, keys.shieldedSecretKeys, keys.dustSecretKey);
  return { walletFacade, walletProvider, keys };
}
