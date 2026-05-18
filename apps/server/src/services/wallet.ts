import { DustWalletState } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { ShieldedWalletState } from '@midnight-ntwrk/wallet-sdk-shielded';
import { UnshieldedWalletState } from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import {
  CoreWallet,
  type UnprovenDustSpend,
  type DustFullInfo,
} from '@midnight-ntwrk/wallet-sdk-dust-wallet/v1';
import { Subscription, firstValueFrom } from 'rxjs';
import { FastifyBaseLogger } from 'fastify';
import {
  Binding,
  nativeToken,
  PreBinding,
  Proof,
  SignatureEnabled,
  Transaction,
} from '@midnight-ntwrk/ledger-v8';
import {
  balanceFinalizedTransaction,
  balanceUnboundTransaction,
  hexToBytes,
  uint8ArrayToHex,
  WalletConnection,
  type WalletStateStore,
} from '@sundaeswap/capacity-exchange-core';

const DEFAULT_BALANCE_TTL_MS = 5 * 60 * 1000;
const PROGRESS_LOG_INTERVAL_MS = 10_000;

export type SubstateProgress = {
  applied: string;
  highest: string;
  gap: string;
  isConnected: boolean;
};

export type WalletSyncState =
  | {
      status: 'syncing';
      dust?: SubstateProgress;
      shielded?: SubstateProgress;
      unshielded?: SubstateProgress;
    }
  | {
      status: 'ok';
      dust?: SubstateProgress;
      shielded?: SubstateProgress;
      unshielded?: SubstateProgress;
    }
  | {
      status: 'ko';
      error: string;
      dust?: SubstateProgress;
      shielded?: SubstateProgress;
      unshielded?: SubstateProgress;
    };

// Each substate SDK exposes a slightly different progress shape:
//   dust + shielded: { appliedIndex, highestIndex, isConnected }    (block indices)
//   unshielded:      { appliedId, highestTransactionId, isConnected } (tx ids)
// Normalized to a single wire format: { applied, highest, gap, isConnected }.
type IndexProgress = {
  readonly appliedIndex: bigint;
  readonly highestIndex: bigint;
  readonly isConnected: boolean;
};
type IdProgress = {
  readonly appliedId: bigint;
  readonly highestTransactionId: bigint;
  readonly isConnected: boolean;
};

function fromIndex(p: IndexProgress): SubstateProgress {
  return {
    applied: p.appliedIndex.toString(),
    highest: p.highestIndex.toString(),
    gap: (p.highestIndex - p.appliedIndex).toString(),
    isConnected: p.isConnected,
  };
}

function fromId(p: IdProgress): SubstateProgress {
  return {
    applied: p.appliedId.toString(),
    highest: p.highestTransactionId.toString(),
    gap: (p.highestTransactionId - p.appliedId).toString(),
    isConnected: p.isConnected,
  };
}

/**
 * Manages the lifecycle and sync'ing of a Midnight DUST wallet.
 */
export class WalletService {
  private readonly logger: FastifyBaseLogger;
  private readonly walletConnection: WalletConnection;
  private readonly walletStateStore: WalletStateStore;

  // Holds the higher-level wallet sync state
  private _syncState: WalletSyncState = { status: 'syncing' };
  // Once the wallet is sync'd this subscription drives the wallet state
  private dustWalletSub: Subscription | null = null;
  private shieldedWalletSub: Subscription | null = null;
  private unshieldedWalletSub: Subscription | null = null;
  // The current view of the wallet's state, populated by the subscription
  private lastDustWalletState: DustWalletState | null = null;
  private lastShieldedWalletState: ShieldedWalletState | null = null;
  private lastUnshieldedWalletState: UnshieldedWalletState | null = null;
  // Periodic progress logger handle
  private progressLogTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    walletConnection: WalletConnection,
    logger: FastifyBaseLogger,
    walletStateStore: WalletStateStore,
  ) {
    this.walletConnection = walletConnection;
    this.logger = logger;
    this.walletStateStore = walletStateStore;
  }

  async start() {
    this.logger.info('Starting WalletService');

    const { walletFacade, keys } = this.walletConnection;

    // Subscribe to dust state before starting so we capture sync progress
    this.dustWalletSub = walletFacade.dust.state.subscribe({
      next: (dustWalletState) => {
        const prevCoins = this.lastDustWalletState?.totalCoins.length ?? 0;
        const firstObservation = this.lastDustWalletState === null;
        this.lastDustWalletState = dustWalletState;
        if (firstObservation) {
          this.logger.info(
            { progress: fromIndex(dustWalletState.progress) },
            'Wallet dust: initial state observed',
          );
        }
        if (
          this._syncState.status === 'syncing' &&
          dustWalletState.totalCoins.length !== prevCoins
        ) {
          this.logger.info({ coins: dustWalletState.totalCoins.length }, 'Wallet syncing...');
        }
        this.walletStateStore.saveWalletState(walletFacade);
      },
      error: (err) => {
        this.logger.error(err, 'DUST wallet state subscription error');
        this._syncState = { ...this._syncState, status: 'ko', error: String(err) };
      },
    });

    // Mirror dust subscription for the other two substates so /health/ready
    // and the periodic log can surface their progress. These don't drive the
    // save trigger (dust still does) or syncState transitions; they're
    // observability-only.
    this.shieldedWalletSub = walletFacade.shielded.state.subscribe({
      next: (s) => {
        if (this.lastShieldedWalletState === null) {
          this.logger.info(
            { progress: fromIndex(s.progress) },
            'Wallet shielded: initial state observed',
          );
        }
        this.lastShieldedWalletState = s;
      },
      error: (err) => {
        this.logger.warn(err, 'Shielded wallet state subscription error (observability only)');
      },
    });
    this.unshieldedWalletSub = walletFacade.unshielded.state.subscribe({
      next: (s) => {
        if (this.lastUnshieldedWalletState === null) {
          this.logger.info(
            { progress: fromId(s.progress) },
            'Wallet unshielded: initial state observed',
          );
        }
        this.lastUnshieldedWalletState = s;
      },
      error: (err) => {
        this.logger.warn(err, 'Unshielded wallet state subscription error (observability only)');
      },
    });

    // Periodic progress snapshot. Renders even when no coin-count change has
    // happened, so operators can see a stalled-but-syncing wallet vs idle.
    this.progressLogTimer = setInterval(() => {
      const snapshot: Record<string, SubstateProgress | undefined> = {
        dust: this.lastDustWalletState ? fromIndex(this.lastDustWalletState.progress) : undefined,
        shielded: this.lastShieldedWalletState
          ? fromIndex(this.lastShieldedWalletState.progress)
          : undefined,
        unshielded: this.lastUnshieldedWalletState
          ? fromId(this.lastUnshieldedWalletState.progress)
          : undefined,
      };
      this.logger.info(snapshot, 'Wallet progress');
    }, PROGRESS_LOG_INTERVAL_MS);

    // Start the wallet
    await walletFacade.start(keys.shieldedSecretKeys, keys.dustSecretKey);

    // Background sync — transitions to 'ok' or 'ko'
    walletFacade.dust.waitForSyncedState().then(
      async () => {
        this._syncState = { status: 'ok' };
        const { unshielded, shielded, dust } = await this.getBalances();
        this.logger.info(
          {
            unshielded: unshielded.toString(),
            shielded: shielded.toString(),
            dust: dust.toString(),
          },
          'Wallet synced, balances:',
        );
      },
      (err) => {
        this.logger.error(err, 'Wallet sync failed');
        this._syncState = { status: 'ko', error: String(err) };
      },
    );
  }

  async stop() {
    this.logger.info('Stopping WalletService');

    if (this.progressLogTimer) {
      clearInterval(this.progressLogTimer);
      this.progressLogTimer = null;
    }
    for (const sub of [this.dustWalletSub, this.shieldedWalletSub, this.unshieldedWalletSub]) {
      sub?.unsubscribe();
    }
    this.dustWalletSub = null;
    this.shieldedWalletSub = null;
    this.unshieldedWalletSub = null;
  }

  spend(utxo: DustFullInfo, amount: bigint, ctime: Date): UnprovenDustSpend {
    const state = this.lastDustWalletState;
    if (!state) {
      throw new Error('dust wallet not synced');
    }
    const [spends] = CoreWallet.spendCoins(
      state.state,
      this.walletConnection.keys.dustSecretKey,
      [{ token: utxo.token, value: amount }],
      ctime,
    );

    return spends[0];
  }

  public async getBalances() {
    const state = await firstValueFrom(this.walletConnection.walletFacade.state());
    // TODO: does it make sense to collect balances on ALL tokens, not just the native token?
    const unshielded = state.unshielded?.balances[nativeToken().raw] ?? 0n;
    const shielded = state.shielded?.balances[nativeToken().raw] ?? 0n;
    const dust = state.dust?.balance(new Date()) ?? 0n;
    return { unshielded, shielded, dust };
  }

  public async getShieldedTokenBalances(): Promise<Record<string, bigint>> {
    const state = await this.walletConnection.walletFacade.shielded.waitForSyncedState();
    return state.balances;
  }

  public async balanceUnsealedTransaction(txHex: string): Promise<{ tx: string }> {
    const tx = Transaction.deserialize<SignatureEnabled, Proof, PreBinding>(
      'signature',
      'proof',
      'pre-binding',
      hexToBytes(txHex),
    );
    const ttl = new Date(Date.now() + DEFAULT_BALANCE_TTL_MS);
    const balancedTx = await balanceUnboundTransaction(this.walletConnection, tx, ttl);
    return { tx: uint8ArrayToHex(balancedTx.serialize()) };
  }

  public async balanceSealedTransaction(txHex: string): Promise<{ tx: string }> {
    const tx = Transaction.deserialize<SignatureEnabled, Proof, Binding>(
      'signature',
      'proof',
      'binding',
      hexToBytes(txHex),
    );
    const ttl = new Date(Date.now() + DEFAULT_BALANCE_TTL_MS);
    const balancedTx = await balanceFinalizedTransaction(this.walletConnection, tx, ttl);
    return { tx: uint8ArrayToHex(balancedTx.serialize()) };
  }

  get shieldedPublicKeys() {
    const { shieldedSecretKeys } = this.walletConnection.keys;
    return {
      coinPublicKey: shieldedSecretKeys.coinPublicKey,
      encryptionPublicKey: shieldedSecretKeys.encryptionPublicKey,
    };
  }

  get syncState(): WalletSyncState {
    // Splice in the latest per-substate progress so /health/ready always shows
    // the operator where the wallet currently sits, regardless of overall status.
    return {
      ...this._syncState,
      dust: this.lastDustWalletState ? fromIndex(this.lastDustWalletState.progress) : undefined,
      shielded: this.lastShieldedWalletState
        ? fromIndex(this.lastShieldedWalletState.progress)
        : undefined,
      unshielded: this.lastUnshieldedWalletState
        ? fromId(this.lastUnshieldedWalletState.progress)
        : undefined,
    } as WalletSyncState;
  }

  get state(): DustWalletState | null {
    return this.lastDustWalletState;
  }
}
