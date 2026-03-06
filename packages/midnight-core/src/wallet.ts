import { DustWallet, type DustWallet as DustWalletType } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { ShieldedWallet, type ShieldedWallet as ShieldedWalletType } from '@midnight-ntwrk/wallet-sdk-shielded';
import {
  UnshieldedWallet,
  InMemoryTransactionHistoryStorage,
  PublicKey,
} from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import type { ZswapSecretKeys, DustSecretKey } from '@midnight-ntwrk/ledger-v7';
import { deriveWalletKeys, type WalletKeys } from './keys';
import { DustWalletProvider } from './dustWalletProvider';
import { DUST_PARAMS } from './params';
import type { WalletConfig } from './walletConfig';

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
  const syncPromise = Promise.all([walletFacade.shielded.waitForSyncedState(), walletFacade.dust.waitForSyncedState()]);

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
  const { seedHex, walletConfig, savedShieldedState, savedDustState } = options;

  const keys = deriveWalletKeys(seedHex, walletConfig.networkId);

  const shieldedWallet = createShieldedWallet(walletConfig, keys.shieldedSecretKeys, savedShieldedState);
  const dustWallet = createDustWallet(walletConfig, keys.dustSecretKey, savedDustState);
  const unshieldedWallet = UnshieldedWallet({
    ...walletConfig,
    txHistoryStorage: new InMemoryTransactionHistoryStorage(),
  }).startWithPublicKey(PublicKey.fromKeyStore(keys.unshieldedKeystore));

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
