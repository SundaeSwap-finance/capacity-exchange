import { InMemoryTransactionHistoryStorage, TransactionHistoryStorage } from '@midnight-ntwrk/wallet-sdk';
import { ShieldedWallet, type ShieldedWallet as ShieldedWalletType } from '@midnight-ntwrk/wallet-sdk/shielded';
import { UnshieldedWallet, PublicKey } from '@midnight-ntwrk/wallet-sdk/unshielded';
import { DustWallet, type DustWalletAPI, type DustWallet as DustWalletType } from '@midnight-ntwrk/wallet-sdk/dust';
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk/facade';
import type { ZswapSecretKeys, DustSecretKey } from '@midnight-ntwrk/ledger-v8';
import { deriveWalletKeys, type WalletKeys } from './keys.js';
import { DUST_PARAMS } from './params.js';
import type { WalletConfig } from './walletConfig.js';
import { firstValueFrom } from 'rxjs';

/**
 * How the DUST sub-wallet should behave.
 *
 * - `sync` (default): a real DUST wallet that syncs from the indexer and can pay fees.
 * - `none`: an inert DUST wallet that never syncs. Its address and (always zero) balance stay
 *   readable, but it cannot balance transactions. Use this for wallets whose fees are paid by a
 *   capacity exchange, where syncing DUST costs minutes and megabytes for a balance of zero.
 */
export type DustMode = 'sync' | 'none';

/** Options for constructing a wallet. Saved state fields enable restoring from a previous session. */
export interface CreateWalletOptions {
  seedHex: string;
  walletConfig: WalletConfig;
  savedShieldedState?: string;
  savedUnshieldedState?: string;
  savedDustState?: string;
  /** Defaults to `sync`. */
  dustMode?: DustMode;
}

export interface WalletConnection {
  walletFacade: WalletFacade;
  keys: WalletKeys;
}

/**
 * Derive keys from a seed and construct a WalletFacade with shielded,
 * unshielded, and dust wallets. Does not start or sync.
 */
export async function createWallet(options: CreateWalletOptions): Promise<WalletConnection> {
  const { seedHex, walletConfig, savedShieldedState, savedUnshieldedState, savedDustState, dustMode } = options;

  const keys = deriveWalletKeys(seedHex, walletConfig.networkId);

  const shieldedWallet = createShieldedWallet(walletConfig, keys.shieldedSecretKeys, savedShieldedState);
  const unshieldedWallet = createUnshieldedWallet(walletConfig, keys.unshieldedKeystore, savedUnshieldedState);
  // An inert DUST wallet is always empty, so saved DUST state is skipped rather than deserialized.
  const inert = dustMode === 'none';
  const realDustWallet = createDustWallet(walletConfig, keys.dustSecretKey, inert ? undefined : savedDustState);
  const dustWallet = inert ? inertDustWallet(realDustWallet) : realDustWallet;

  // TODO: Move wallet creation into the factory functions
  const walletFacade = await WalletFacade.init({
    configuration: {
      ...walletConfig,
      txHistoryStorage: new InMemoryTransactionHistoryStorage(TransactionHistoryStorage.TransactionHistoryCommonSchema),
    },
    shielded: () => shieldedWallet,
    unshielded: () => unshieldedWallet,
    dust: () => dustWallet,
  });

  return { walletFacade, keys };
}

function createShieldedWallet(
  config: WalletConfig,
  shieldedSecretKeys: ZswapSecretKeys,
  savedState?: string
): ShieldedWalletType {
  if (savedState) {
    try {
      return ShieldedWallet({
        ...config,
        txHistoryStorage: new InMemoryTransactionHistoryStorage(
          TransactionHistoryStorage.TransactionHistoryCommonSchema
        ),
      }).restore(savedState);
    } catch {
      // Fall through to fresh start
    }
  }
  return ShieldedWallet({
    ...config,
    txHistoryStorage: new InMemoryTransactionHistoryStorage(TransactionHistoryStorage.TransactionHistoryCommonSchema),
  }).startWithSecretKeys(shieldedSecretKeys);
}

function createUnshieldedWallet(
  config: WalletConfig,
  unshieldedKeystore: WalletKeys['unshieldedKeystore'],
  savedState?: string
) {
  // We don't use transaction history; NoOp avoids accumulating unused data in memory
  const walletBuilder = UnshieldedWallet({
    ...config,
    txHistoryStorage: new InMemoryTransactionHistoryStorage(TransactionHistoryStorage.TransactionHistoryCommonSchema),
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
      return DustWallet({
        ...config,
        txHistoryStorage: new InMemoryTransactionHistoryStorage(
          TransactionHistoryStorage.TransactionHistoryCommonSchema
        ),
      }).restore(savedState);
    } catch {
      // Fall through to fresh start
    }
  }
  return DustWallet({
    ...config,
    txHistoryStorage: new InMemoryTransactionHistoryStorage(TransactionHistoryStorage.TransactionHistoryCommonSchema),
  }).startWithSecretKey(dustSecretKey, DUST_PARAMS);
}

/**
 * Wraps a DUST wallet so it never talks to the indexer.
 *
 * The wrapped wallet is built by `startWithSecretKey`, which initializes an empty state locally —
 * syncing only begins in `start()`. Overriding `start` keeps that state empty forever, so the
 * address (derived from the secret key) and a zero balance stay readable for display, while the
 * multi-megabyte DUST chain state is never fetched, deserialized, or persisted.
 *
 * `waitForSyncedState` must be overridden too: sync completeness requires `isConnected`, so on a
 * wallet that never starts it would wait forever. Fee-paying methods throw rather than silently
 * producing a transaction with no DUST to fund it.
 */
function inertDustWallet(dust: DustWalletType): DustWalletAPI {
  const unavailable = (method: string) => (): never => {
    throw new Error(
      `DustWallet.${method} is unavailable: this wallet was created with dustMode 'none'. ` +
        `Fees must be paid by a capacity exchange, or create the wallet with dustMode 'sync'.`
    );
  };

  return {
    state: dust.state,
    start: async () => {},
    stop: async () => {},
    waitForSyncedState: () => firstValueFrom(dust.state),
    getAddress: () => dust.getAddress(),
    serializeState: () => dust.serializeState(),
    // Fee estimation reads ledger parameters, not wallet state, so it stays usable.
    calculateFee: (transactions) => dust.calculateFee(transactions),
    estimateFee: (secretKey, transactions, ttl, currentTime) =>
      dust.estimateFee(secretKey, transactions, ttl, currentTime),
    balanceTransactions: unavailable('balanceTransactions'),
    createDustGenerationTransaction: unavailable('createDustGenerationTransaction'),
    addDustGenerationSignature: unavailable('addDustGenerationSignature'),
    splitNightUtxosForDustRegistration: unavailable('splitNightUtxosForDustRegistration'),
    attachDustRegistration: unavailable('attachDustRegistration'),
    addDustRegistrationSignature: unavailable('addDustRegistrationSignature'),
    revertTransaction: async () => {},
  };
}
