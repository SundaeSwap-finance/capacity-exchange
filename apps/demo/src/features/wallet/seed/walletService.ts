import type { WalletKeys, WalletConnection } from '@sundaeswap/capacity-exchange-core';
export type { WalletKeys } from '@sundaeswap/capacity-exchange-core';
import type { NetworkId } from '@midnight-ntwrk/wallet-sdk-abstractions';
import type { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import type { NetworkConfig } from '../../../config';
import { loadSnapshots } from '../../../lib/walletSnapshot';
import { buildSyntheticWalletState } from '@sundaeswap/capacity-exchange-core';

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
  dust: SubWalletProgress;
  unshielded: boolean;
}

export type SyncProgressCallback = (progress: SyncProgressInfo) => void;

/**
 * Creates and syncs a wallet from a seed.
 *
 * For new wallets (isNewWallet=true), attempts to use pre-synced chain state
 * snapshots so the wallet only needs to catch up from the snapshot offset
 * instead of scanning the entire blockchain from genesis.
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

  // For new wallets, try to use pre-synced snapshots to skip most of the sync
  let saved = await store.loadWalletState();
  if (isNewWallet && !saved.savedShieldedState) {
    console.debug('[WalletService] New wallet — loading chain state snapshots...');
    const snapshots = await loadSnapshots(config.networkId);
    if (snapshots) {
      const synthetic = buildSyntheticWalletState(snapshots, keys, config.networkId);
      saved = synthetic;
      console.debug('[WalletService] Using pre-synced snapshot at offset', snapshots.shielded.offset);
    } else {
      console.warn('[WalletService] No snapshots available for', config.networkId, '— syncing from genesis');
    }
  }

  const fullOptions = { seedHex, walletConfig, ...saved };

  let connection: WalletConnection;
  try {
    console.debug('[WalletService] Creating wallet...', saved.savedShieldedState ? 'with saved state' : 'fresh');
    connection = await createWallet(fullOptions);
    console.debug('[WalletService] Wallet created');
  } catch (err) {
    console.warn('[WalletService] Restore failed, starting fresh:', err);
    await store.clearAll();
    connection = await createWallet({ seedHex, walletConfig });
    console.debug('[WalletService] Wallet created (fresh fallback)');
  }

  const { walletFacade } = connection;

  // Track sync progress from all three sub-wallets
  const progress: SyncProgressInfo = {
    shielded: { appliedIndex: 0n, targetIndex: 0n, done: false },
    dust: { appliedIndex: 0n, targetIndex: 0n, done: false },
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

  const dustSub = walletFacade.dust.state.subscribe({
    next: (state) => {
      const p = state.progress;
      progress.dust = {
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
  await Promise.all([
    walletFacade.shielded.waitForSyncedState().then(() => console.debug('[WalletService] Shielded synced')),
    walletFacade.dust.waitForSyncedState().then(() => console.debug('[WalletService] Dust synced')),
    // Skip unshielded — we don't use unshielded balances in the demo
  ]);
  console.debug('[WalletService] All synced');

  shieldedSub.unsubscribe();
  dustSub.unsubscribe();
  unshieldedSub.unsubscribe();

  // Save shielded + dust only — unshielded serializeState would hang
  store.saveShieldedAndDust(connection.walletFacade).catch(() => {});

  console.log('[WalletService] Returning connection');
  return { walletFacade: connection.walletFacade, keys: connection.keys, networkId: config.networkId };
}
