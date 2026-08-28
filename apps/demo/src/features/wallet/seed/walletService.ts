import type { WalletKeys, WalletConnection } from '@sundaeswap/capacity-exchange-core';
export type { WalletKeys } from '@sundaeswap/capacity-exchange-core';
import type { NetworkId } from '@midnight-ntwrk/wallet-sdk';
import type { WalletFacade } from '@midnight-ntwrk/wallet-sdk/facade';
import type { NetworkConfig } from '../../../config';
import { loadSnapshots } from '../../../lib/walletSnapshot';

// Lazy-load the heavy midnight-core module (pulls in 10MB+ WASM) only when needed
async function loadMidnightCore() {
  return import('@sundaeswap/capacity-exchange-core');
}

export interface SeedWalletConnection {
  walletFacade: WalletFacade;
  keys: WalletKeys;
  networkId: string;
}

export interface SubWalletProgress {
  appliedIndex: bigint;
  targetIndex: bigint;
  done: boolean;
}

export interface SyncProgressInfo {
  shielded: SubWalletProgress;
  unshielded: boolean;
}

export type SyncProgressCallback = (progress: SyncProgressInfo) => void;

/**
 * Creates and syncs a wallet from a seed.
 *
 * For new wallets (isNewWallet=true), attempts to use pre-synced chain state
 * snapshots so the wallet only needs to catch up from the snapshot offset
 * instead of scanning the entire blockchain from genesis.
 *
 * The wallet is created with dustMode 'none': every transaction in the demo has its fees paid by a
 * capacity exchange, so the DUST sub-wallet would sync tens of megabytes of chain state only to
 * report a balance of zero. Its address stays readable; it just never syncs.
 */
export async function connectSeedWallet(
  seedHex: string,
  config: NetworkConfig,
  onSyncProgress?: SyncProgressCallback,
  isNewWallet?: boolean
): Promise<SeedWalletConnection> {
  console.debug('[WalletService] Loading WASM...');
  const { createWallet, COST_PARAMS, LocalStorageStateStore, WalletStateStore, deriveWalletKeys } =
    await loadMidnightCore();
  console.debug('[WalletService] WASM loaded');

  const walletConfig = {
    networkId: config.networkId as NetworkId.NetworkId,
    costParameters: COST_PARAMS,
    relayURL: new URL(config.nodeWsUrl),
    provingServerUrl: new URL(config.proofServerUrl),
    indexerClientConnection: {
      indexerHttpUrl: config.indexerUrl,
      indexerWsUrl: config.indexerWsUrl,
    },
  };

  console.debug('[WalletService] Deriving keys...');
  const keys = deriveWalletKeys(seedHex, walletConfig.networkId);
  console.debug('[WalletService] Keys derived');
  const baseStore = new LocalStorageStateStore();
  const store = new WalletStateStore(baseStore, String(walletConfig.networkId), keys.shieldedSecretKeys.coinPublicKey);

  // Reclaim the multi-megabyte DUST state written by earlier versions; it is never read again, and
  // leaving it in place can keep localStorage over quota so shielded state fails to save.
  await store.clearDust().catch(() => {});

  // For new wallets, try to use pre-synced snapshots to skip most of the sync
  let saved = await store.loadWalletState();
  if (isNewWallet && !saved.savedShieldedState) {
    console.debug('[WalletService] New wallet — loading chain state snapshots...');
    const snapshots = await loadSnapshots(config.networkId);
    if (snapshots) {
      const { buildSyntheticWalletState } = await loadMidnightCore();
      const synthetic = buildSyntheticWalletState(snapshots, keys, config.networkId);
      saved = synthetic;
      console.debug('[WalletService] Using pre-synced snapshot at offset', snapshots.shielded.offset);
    } else {
      console.warn('[WalletService] No snapshots available for', config.networkId, '— syncing from genesis');
    }
  }

  const fullOptions = { seedHex, walletConfig, dustMode: 'none' as const, ...saved };

  let connection: WalletConnection;
  try {
    console.debug('[WalletService] Creating wallet...', saved.savedShieldedState ? 'with saved state' : 'fresh');
    connection = await createWallet(fullOptions);
    console.debug('[WalletService] Wallet created');
  } catch (err) {
    console.warn('[WalletService] Restore failed, starting fresh:', err);
    await store.clearAll();
    connection = await createWallet({ seedHex, walletConfig, dustMode: 'none' });
    console.debug('[WalletService] Wallet created (fresh fallback)');
  }

  const { walletFacade } = connection;

  // Track sync progress from the sub-wallets that actually sync
  const progress: SyncProgressInfo = {
    shielded: { appliedIndex: 0n, targetIndex: 0n, done: false },
    unshielded: false,
  };

  const emitProgress = () => onSyncProgress?.({ ...progress });

  const shieldedSub = walletFacade.shielded.state.subscribe({
    next: (state) => {
      const p = state.progress;
      progress.shielded = {
        appliedIndex: p.appliedIndex,
        targetIndex: p.highestRelevantWalletIndex,
        done: p.isStrictlyComplete(),
      };
      emitProgress();
    },
  });

  const unshieldedSub = walletFacade.unshielded.state.subscribe({
    next: (state) => {
      const p = state.progress;
      progress.unshielded = p.isStrictlyComplete?.() ?? true;
      emitProgress();
    },
  });

  console.debug('[WalletService] Calling walletFacade.start()...');
  await walletFacade.start(keys.shieldedSecretKeys, keys.dustSecretKey);
  console.debug('[WalletService] Wallet started, waiting for sync...');
  // Skip unshielded — we don't use unshielded balances in the demo — and DUST, which never syncs
  await walletFacade.shielded.waitForSyncedState();
  console.debug('[WalletService] Shielded synced');

  shieldedSub.unsubscribe();
  unshieldedSub.unsubscribe();

  // Save shielded only: the demo never reads unshielded balances, and the inert DUST wallet's state
  // is empty by design, so neither is worth persisting.
  store.saveShielded(connection.walletFacade).catch((err) => {
    console.warn('[WalletService] Failed to save wallet state:', err);
  });

  console.log('[WalletService] Returning connection');
  return { walletFacade: connection.walletFacade, keys: connection.keys, networkId: config.networkId };
}
