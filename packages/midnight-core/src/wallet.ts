import type { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { deriveWalletKeys } from './keys.js';
import { resolveWalletConfig } from './walletConfig.js';
import { toNetworkIdEnum } from './networks.js';
import type { StateStore } from './stateStore.js';
import { WalletStateStore } from './walletStateStore.js';
import { parseMnemonic } from './seed.js';
import { uint8ArrayToHex } from './hex.js';
import { createWallet, type CreateWalletOptions, type WalletConnection } from './walletFacade.js';

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

export async function startAndSyncWallet(connection: WalletConnection, syncTimeoutMs?: number): Promise<void> {
  const { walletFacade, keys } = connection;
  await walletFacade.start(keys.shieldedSecretKeys, keys.dustSecretKey);
  await waitForSync(walletFacade, syncTimeoutMs);
}

export async function createAndSyncWallet(
  options: CreateWalletOptions,
  syncTimeoutMs?: number
): Promise<WalletConnection> {
  const connection = createWallet(options);
  await startAndSyncWallet(connection, syncTimeoutMs);
  return connection;
}

/** Create and sync a wallet with persistent state, retrying fresh if saved state is corrupt. */
export async function createAndSyncWalletWithStore(
  options: CreateWalletOptions,
  baseStore: StateStore,
  syncTimeoutMs?: number
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
    result = await createAndSyncWallet(fullOptions, syncTimeoutMs);
  } catch (error) {
    if (!saved.savedShieldedState && !saved.savedUnshieldedState && !saved.savedDustState) {
      throw error;
    }
    await store.clearAll();
    result = await createAndSyncWallet(options, syncTimeoutMs);
  }

  await store.saveWalletState(result.walletFacade);
  return result;
}

export interface CreateWalletFromMnemonicOptions {
  mnemonic: string;
  networkId: string;
  syncTimeoutMs?: number;
}

/** Parse a mnemonic, resolve wallet config, and create+sync a wallet. */
export async function createWalletFromMnemonic(
  options: CreateWalletFromMnemonicOptions,
  store: StateStore
): Promise<WalletConnection> {
  const seedBytes = parseMnemonic(options.mnemonic);
  const seedHex = uint8ArrayToHex(seedBytes);
  const enumId = toNetworkIdEnum(options.networkId);
  const walletConfig = resolveWalletConfig(enumId);

  return createAndSyncWalletWithStore({ seedHex, walletConfig }, store, options.syncTimeoutMs);
}
