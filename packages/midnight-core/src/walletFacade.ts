import { InMemoryTransactionHistoryStorage, ProtocolVersion } from '@midnight-ntwrk/wallet-sdk';
import { ShieldedWallet } from '@midnight-ntwrk/wallet-sdk/shielded';
import { UnshieldedWallet, PublicKey } from '@midnight-ntwrk/wallet-sdk/unshielded';
import { DustWallet, type DustKeysByEpoch, type DustWalletAPI } from '@midnight-ntwrk/wallet-sdk/dust';
import { WalletFacade, WalletEntrySchema, type ResolvedConfiguration } from '@midnight-ntwrk/wallet-sdk/facade';
import { deriveWalletKeys, type WalletKeys } from './keys.js';
import { DUST_PARAMS } from './params.js';
import { indexerQuery } from './indexer.js';
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

type WalletFacadeConfig = WalletConfig & {
  txHistoryStorage: InMemoryTransactionHistoryStorage<typeof WalletEntrySchema.Type>;
};

/** Restores a wallet from saved state, or starts a fresh one when there is none or it no longer reads. */
async function restoreOrStart<W>(restore: (saved: string) => W, start: () => Promise<W>, saved?: string): Promise<W> {
  if (saved) {
    try {
      return restore(saved);
    } catch {
      // Fall through to fresh start
    }
  }
  return start();
}

/**
 * Derive keys from a seed and construct a WalletFacade with shielded,
 * unshielded, and dust wallets. Does not start or sync.
 */
export async function createWallet(options: CreateWalletOptions): Promise<WalletConnection> {
  const { seedHex, walletConfig, savedShieldedState, savedUnshieldedState, savedDustState, dustMode } = options;

  const keys = deriveWalletKeys(seedHex, walletConfig.networkId);
  // An inert DUST wallet is always empty, so saved DUST state is skipped rather than deserialized.
  const inert = dustMode === 'none';

  const configuration: WalletFacadeConfig = {
    ...walletConfig,
    // We don't read transaction history, but the wallets require a store.
    txHistoryStorage: new InMemoryTransactionHistoryStorage(WalletEntrySchema),
  };

  const walletFacade = await WalletFacade.init({
    configuration,
    shielded: (config: ResolvedConfiguration<WalletFacadeConfig>) => {
      const builder = ShieldedWallet(config);
      return restoreOrStart(
        (saved) => builder.restore(saved),
        () => builder.startWithSeed(keys.seeds.shielded),
        savedShieldedState
      );
    },
    unshielded: (config: ResolvedConfiguration<WalletFacadeConfig>) => {
      const builder = UnshieldedWallet(config);
      return restoreOrStart(
        (saved) => builder.restore(saved),
        () => builder.startWithPublicKey(PublicKey.fromKeyStore(keys.unshieldedKeystore)),
        savedUnshieldedState
      );
    },
    dust: async (config: ResolvedConfiguration<WalletFacadeConfig>) => {
      const builder = DustWallet({
        ...config,
        dustParameters: DUST_PARAMS,
        // The SDK's default probe asks for the chain's *genesis* version, so a fresh wallet can replay history from
        // the start. An inert wallet never syncs, so it would stay at the genesis version forever — on a chain that
        // forked to ledger-v9 (e.g. preview) that pins the whole facade to ledger-v8, and it then refuses every v9
        // transaction. It reads no history, so the tip's version is the one it should act at.
        ...(inert
          ? { chainVersionProbe: () => tipProtocolVersion(walletConfig.indexerClientConnection.indexerHttpUrl) }
          : {}),
      });
      const dust = await restoreOrStart<DustWalletAPI<DustKeysByEpoch>>(
        (saved) => builder.restore(saved),
        () => builder.startWithSeed(keys.seeds.dust, DUST_PARAMS),
        inert ? undefined : savedDustState
      );
      return inert ? inertDustWallet(dust) : dust;
    },
  });

  return { walletFacade, keys };
}

/** The protocol version the chain's latest block was produced under. */
async function tipProtocolVersion(indexerUrl: string): Promise<ProtocolVersion.ProtocolVersion> {
  const { block } = await indexerQuery<{ block: { protocolVersion: number } | null }>(
    indexerUrl,
    '{ block { protocolVersion } }',
    'block.protocolVersion'
  );
  if (!block) {
    throw new Error('Indexer reports no block, so the chain has named no protocol version');
  }
  return ProtocolVersion.ProtocolVersion(BigInt(block.protocolVersion));
}

/**
 * Wraps a DUST wallet so it never talks to the indexer.
 *
 * The wrapped wallet is built by `startWithSeed`, which initializes an empty state locally —
 * syncing only begins in `start()`. Overriding `start` keeps that state empty forever, so the
 * address (derived from the seed) and a zero balance stay readable for display, while the
 * multi-megabyte DUST chain state is never fetched, deserialized, or persisted.
 *
 * `waitForSyncedState` must be overridden too: sync completeness requires `isConnected`, so on a
 * wallet that never starts it would wait forever. Fee-paying methods throw rather than silently
 * producing a transaction with no DUST to fund it.
 */
function inertDustWallet(dust: DustWalletAPI<DustKeysByEpoch>): DustWalletAPI<DustKeysByEpoch> {
  const unavailable = (method: string) => (): never => {
    throw new Error(
      `DustWallet.${method} is unavailable: this wallet was created with dustMode 'none'. ` +
        `Fees must be paid by a capacity exchange, or create the wallet with dustMode 'sync'.`
    );
  };

  return {
    state: dust.state,
    start: async () => {},
    stepSync: async () => {},
    stop: async () => {},
    waitForSyncedState: () => firstValueFrom(dust.state),
    getAddress: () => dust.getAddress(),
    serializeState: () => dust.serializeState(),
    // Fee estimation reads ledger parameters, not wallet state, so it stays usable.
    calculateFee: (transactions) => dust.calculateFee(transactions),
    estimateFee: (transactions, ttl, currentTime) => dust.estimateFee(transactions, ttl, currentTime),
    balanceTransactions: unavailable('balanceTransactions'),
    createDustGenerationTransaction: unavailable('createDustGenerationTransaction'),
    addDustGenerationSignature: unavailable('addDustGenerationSignature'),
    splitNightUtxosForDustRegistration: unavailable('splitNightUtxosForDustRegistration'),
    attachDustRegistration: unavailable('attachDustRegistration'),
    addDustRegistrationSignature: unavailable('addDustRegistrationSignature'),
    waitForGeneratedDust: unavailable('waitForGeneratedDust'),
    ensureFeeCoverage: unavailable('ensureFeeCoverage'),
    revertTransaction: async () => {},
  };
}
