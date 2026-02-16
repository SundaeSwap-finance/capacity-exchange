import {
  DustTokenFullInfo,
  DustWalletState,
  UnprovenDustSpend,
} from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { Subscription, firstValueFrom } from 'rxjs';
import { FastifyBaseLogger } from 'fastify';
import { nativeToken } from '@midnight-ntwrk/ledger-v6';
import { WalletContext } from '../utils/wallet.js';
import { StateWriter } from './state-writer.js';

export type WalletSyncState =
  | { status: 'syncing' }
  | { status: 'ok' }
  | { status: 'ko'; error: string };

/**
 * Manages the lifecycle and sync'ing of a Midnight DUST wallet.
 */
export class WalletService {
  private readonly logger: FastifyBaseLogger;
  private readonly walletContext: WalletContext;
  private readonly stateWriter: StateWriter<DustWalletState>;

  // Holds the higher-level wallet sync state
  private _syncState: WalletSyncState = { status: 'syncing' };
  // Once the wallet is sync'd this subscription drives the wallet state
  private dustWalletSub: Subscription | null = null;
  // The current view of the wallet's state, populated by the subscription
  private lastDustWalletState: DustWalletState | null = null;

  constructor(
    walletContext: WalletContext,
    logger: FastifyBaseLogger,
    dustWalletStateFile: string,
  ) {
    this.walletContext = walletContext;
    this.logger = logger;
    this.stateWriter = new StateWriter(
      dustWalletStateFile,
      {
        hash: (state: DustWalletState) =>
          `${state.totalCoins.length}-${state.walletBalance(new Date())}`,
      },
      logger.child({ service: 'StateWriter' }),
    );
  }

  async start() {
    this.logger.info('Starting WalletService');
    await this.walletContext.start();

    // Subscribe to wallet state updates (logs progress during sync, persists after)
    let lastLoggedCoins = -1;
    this.dustWalletSub = this.walletContext.walletFacade.dust.state.subscribe({
      next: (dustWalletState) => {
        this.lastDustWalletState = dustWalletState;

        if (this._syncState.status === 'ok') {
          // After sync: persist state changes
          this.stateWriter.schedule(dustWalletState);
        } else {
          // During sync: log progress when coin count changes
          const coins = dustWalletState.totalCoins.length;
          if (coins !== lastLoggedCoins) {
            lastLoggedCoins = coins;
            const balance = dustWalletState.walletBalance(new Date());
            this.logger.info({ coins, balance: balance.toString() }, 'Sync progress');
          }
        }
      },
      error: (err) => {
        this.logger.error(err, 'DUST wallet state subscription error');
        this._syncState = { status: 'ko', error: String(err) };
      },
    });

    // Wait for sync to complete in background
    this.walletContext.walletFacade.dust
      .waitForSyncedState()
      .then(async (syncedWalletState) => {
        this.logger.info({ state: syncedWalletState.state }, "DUST wallet sync'd");
        this._syncState = { status: 'ok' };

        const now = new Date();
        const coins = syncedWalletState.availableCoinsWithFullInfo(now);
        if (coins.length > 0) {
          this.logger.info({ count: coins.length }, 'Available DUST UTxOs found');
          this.logger.debug({ coins });
        } else {
          this.logger.warn('No DUST UTxOs found. The service requires DUST UTxOs.');
        }

        // Persist initial synced state
        this.stateWriter.schedule(syncedWalletState);
        await this.stateWriter.flush();

        const { unshielded, shielded, dust } = await this.getBalances();
        this.logger.debug(
          {
            unshielded: unshielded.toString(),
            shielded: shielded.toString(),
            dust: dust.toString(),
          },
          'Wallet Balances',
        );
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(error, 'Dust wallet sync failed');
        this._syncState = { status: 'ko', error: message };
      });
  }

  async stop() {
    this.logger.info('Stopping WalletService');

    // Flush any pending state writes
    await this.stateWriter.flush();

    if (this.dustWalletSub) {
      this.dustWalletSub.unsubscribe();
      this.dustWalletSub = null;
    }
  }

  spend(utxo: DustTokenFullInfo, amount: bigint): UnprovenDustSpend {
    const state = this.lastDustWalletState;
    if (!state) {
      throw new Error('dust wallet not synced');
    }
    const [[spend]] = state.state.spendCoins(
      this.walletContext.dustSecretKey,
      [{ token: utxo.token, value: amount }],
      new Date(),
    );

    return spend;
  }

  public async getBalances() {
    const state = await firstValueFrom(this.walletContext.walletFacade.state());
    const unshielded = state.unshielded?.balances[nativeToken().raw] ?? 0n;
    const shielded = state.shielded?.balances[nativeToken().raw] ?? 0n;
    const dust = state.dust?.walletBalance(new Date()) ?? 0n;
    return { unshielded, shielded, dust };
  }

  get syncState(): WalletSyncState {
    return this._syncState;
  }

  get state(): DustWalletState | null {
    return this.lastDustWalletState;
  }
}
