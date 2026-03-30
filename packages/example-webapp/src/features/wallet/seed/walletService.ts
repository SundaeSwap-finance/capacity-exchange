import {
  createWallet,
  COST_PARAMS,
  LocalStorageStateStore,
  WalletStateStore,
  deriveWalletKeys,
  type WalletKeys,
  type WalletConnection,
} from '@capacity-exchange/midnight-core';
export type { WalletKeys } from '@capacity-exchange/midnight-core';
import type { NetworkId } from '@midnight-ntwrk/wallet-sdk-abstractions';
import type { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import type { NetworkConfig } from '../../../config';

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
 * Calls onSyncProgress with sync progress updates during the sync phase.
 * Wallet state is persisted to localStorage for faster subsequent syncs.
 */
export async function connectSeedWallet(
  seedHex: string,
  config: NetworkConfig,
  onSyncProgress?: SyncProgressCallback
): Promise<SeedWalletConnection> {
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

  const keys = deriveWalletKeys(seedHex, walletConfig.networkId);
  const baseStore = new LocalStorageStateStore();
  const store = new WalletStateStore(
    baseStore,
    String(walletConfig.networkId),
    keys.shieldedSecretKeys.coinPublicKey
  );
  const saved = await store.loadWalletState();
  const fullOptions = { seedHex, walletConfig, ...saved };

  let connection: WalletConnection;
  try {
    connection = await createWallet(fullOptions);
  } catch {
    await store.clearAll();
    connection = await createWallet({ seedHex, walletConfig });
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
      const p = state.progress as any;
      progress.unshielded = p.isStrictlyComplete?.() ?? true;
      emitProgress();
    },
  });

  await walletFacade.start(keys.shieldedSecretKeys, keys.dustSecretKey);
  await Promise.all([
    walletFacade.shielded.waitForSyncedState(),
    walletFacade.unshielded.waitForSyncedState(),
    walletFacade.dust.waitForSyncedState(),
  ]);

  shieldedSub.unsubscribe();
  dustSub.unsubscribe();
  unshieldedSub.unsubscribe();

  await store.saveWalletState(connection.walletFacade);
  return { walletFacade: connection.walletFacade, keys: connection.keys, networkId: config.networkId };
}
