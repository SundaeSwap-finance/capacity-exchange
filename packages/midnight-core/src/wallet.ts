import { ShieldedWallet, type ShieldedWallet as ShieldedWalletType } from '@midnight-ntwrk/wallet-sdk-shielded';
import {
  UnshieldedWallet,
  NoOpTransactionHistoryStorage,
  PublicKey,
} from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import { DustWallet, type DustWallet as DustWalletType } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import type { ZswapSecretKeys, DustSecretKey } from '@midnight-ntwrk/ledger-v7';
import { deriveWalletKeys, type WalletKeys } from './keys.js';
import { DustWalletProvider } from './dustWalletProvider.js';
import { DUST_PARAMS } from './params.js';
import type { WalletConfig } from './walletConfig.js';
import type { StateStore } from './stateStore.js';
import { WalletStateStore } from './walletStateStore.js';

export class WalletSyncTimeoutError extends Error {
  readonly _tag = 'WalletSyncTimeoutError' as const;
  constructor(timeoutMs: number) {
    super(
      `Wallet sync timed out after ${timeoutMs / 1000}s. ` +
        `Try running 'just clean', re-deploying contracts, and restarting the server.`
    );
    this.name = 'WalletSyncTimeoutError';
  }
}

export interface CreateWalletOptions {
  seedHex: string;
  walletConfig: WalletConfig;
  savedShieldedState?: string;
  savedUnshieldedState?: string;
  savedDustState?: string;
}

export interface CreateAndSyncWalletOptions extends CreateWalletOptions {
  syncTimeoutMs?: number;
}

export interface WalletConnection {
  walletFacade: WalletFacade;
  walletProvider: DustWalletProvider;
  keys: WalletKeys;
}

function createShieldedWallet(
  config: WalletConfig,
  shieldedSecretKeys: ZswapSecretKeys,
  savedState?: string
): ShieldedWalletType {
  if (savedState) {
    try {
      return ShieldedWallet(config).restore(savedState);
    } catch {
      // Fall through to fresh start
    }
  }
  return ShieldedWallet(config).startWithSecretKeys(shieldedSecretKeys);
}

function createUnshieldedWallet(
  config: WalletConfig,
  unshieldedKeystore: WalletKeys['unshieldedKeystore'],
  savedState?: string
) {
  // We don't use transaction history; NoOp avoids accumulating unused data in memory
  const walletBuilder = UnshieldedWallet({
    ...config,
    txHistoryStorage: new NoOpTransactionHistoryStorage(),
  });
  if (savedState) {
    try {
      return walletBuilder.restore(savedState);
    } catch {
      // Fall through to fresh start
    }
  }
  return walletBuilder.startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeystore));
}

function createDustWallet(config: WalletConfig, dustSecretKey: DustSecretKey, savedState?: string): DustWalletType {
  if (savedState) {
    try {
      return DustWallet(config).restore(savedState);
    } catch {
      // Fall through to fresh start
    }
  }
  return DustWallet(config).startWithSecretKey(dustSecretKey, DUST_PARAMS);
}

async function waitForSync(walletFacade: WalletFacade, timeoutMs?: number): Promise<void> {
  const syncPromise = Promise.all([
    walletFacade.shielded.waitForSyncedState(),
    walletFacade.unshielded.waitForSyncedState(),
    walletFacade.dust.waitForSyncedState(),
  ]);

  if (timeoutMs) {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new WalletSyncTimeoutError(timeoutMs)), timeoutMs)
    );
    await Promise.race([syncPromise, timeout]);
  } else {
    await syncPromise;
  }
}

export function createWallet(options: CreateWalletOptions): WalletConnection {
  const { seedHex, walletConfig, savedShieldedState, savedUnshieldedState, savedDustState } = options;

  const keys = deriveWalletKeys(seedHex, walletConfig.networkId);

  const shieldedWallet = createShieldedWallet(walletConfig, keys.shieldedSecretKeys, savedShieldedState);
  const unshieldedWallet = createUnshieldedWallet(walletConfig, keys.unshieldedKeystore, savedUnshieldedState);
  const dustWallet = createDustWallet(walletConfig, keys.dustSecretKey, savedDustState);

  const walletFacade = new WalletFacade(shieldedWallet, unshieldedWallet, dustWallet);
  const walletProvider = new DustWalletProvider(walletFacade, keys.shieldedSecretKeys, keys.dustSecretKey);

  return { walletFacade, walletProvider, keys };
}

export async function startAndSyncWallet(connection: WalletConnection, syncTimeoutMs?: number): Promise<void> {
  const { walletFacade, keys } = connection;
  await walletFacade.start(keys.shieldedSecretKeys, keys.dustSecretKey);
  await waitForSync(walletFacade, syncTimeoutMs);
}

export async function createAndSyncWallet(options: CreateAndSyncWalletOptions): Promise<WalletConnection> {
  const { syncTimeoutMs, ...createOptions } = options;
  const connection = createWallet(createOptions);
  await startAndSyncWallet(connection, syncTimeoutMs);
  return connection;
}

/** Create and sync a wallet with persistent state, retrying fresh if saved state is corrupt. */
export async function createAndSyncWalletWithStore(
  options: CreateAndSyncWalletOptions,
  baseStore: StateStore
): Promise<WalletConnection> {
  const keys = deriveWalletKeys(options.seedHex, options.walletConfig.networkId);
  const store = new WalletStateStore(
    baseStore,
    String(options.walletConfig.networkId),
    keys.shieldedSecretKeys.coinPublicKey
  );
  const saved = await store.loadWalletState();
  const fullOptions = { ...options, ...saved };

  let result: WalletConnection;
  try {
    result = await createAndSyncWallet(fullOptions);
  } catch (error) {
    if (!saved.savedShieldedState && !saved.savedUnshieldedState && !saved.savedDustState) {
      throw error;
    }
    await store.clearAll();
    result = await createAndSyncWallet(options);
  }

  await store.saveWalletState(result.walletFacade);
  return result;
}
