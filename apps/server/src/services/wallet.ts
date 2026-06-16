import { DustWalletState } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import {
  CoreWallet,
  type UnprovenDustSpend,
  type DustFullInfo,
} from '@midnight-ntwrk/wallet-sdk-dust-wallet/v1';
import { Subscription, firstValueFrom } from 'rxjs';
import { FastifyBaseLogger } from 'fastify';
import { nativeToken } from '@midnight-ntwrk/ledger-v8';

import {
  makeTokenOnlyBalanceFunctions,
  WalletConnection,
  type WalletStateStore,
} from '@sundaeswap/capacity-exchange-core';

export type WalletSyncState =
  | { status: 'syncing' }
  | { status: 'ok' }
  | { status: 'ko'; error: string };

/**
 * Manages the lifecycle and sync'ing of a Midnight DUST wallet.
 */
export class WalletService {
  private readonly logger: FastifyBaseLogger;
  private readonly walletConnection: WalletConnection;
  private readonly walletStateStore: WalletStateStore;
  private readonly balanceFns: ReturnType<typeof makeTokenOnlyBalanceFunctions>;

  // Holds the higher-level wallet sync state
  private _syncState: WalletSyncState = { status: 'syncing' };
  // Once the wallet is sync'd this subscription drives the wallet state
  private dustWalletSub: Subscription | null = null;
  // The current view of the wallet's state, populated by the subscription
  private lastDustWalletState: DustWalletState | null = null;
  constructor(
    walletConnection: WalletConnection,
    logger: FastifyBaseLogger,
    walletStateStore: WalletStateStore,
  ) {
    this.walletConnection = walletConnection;
    this.logger = logger;
    this.walletStateStore = walletStateStore;
    this.balanceFns = makeTokenOnlyBalanceFunctions(walletConnection);
  }

  async start() {
    this.logger.info('Starting WalletService');

    const { walletFacade, keys } = this.walletConnection;

    // Subscribe to dust state before starting so we capture sync progress
    this.dustWalletSub = walletFacade.dust.state.subscribe({
      next: (dustWalletState) => {
        const prevCoins = this.lastDustWalletState?.totalCoins.length ?? 0;
        this.lastDustWalletState = dustWalletState;
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
        this._syncState = { status: 'ko', error: String(err) };
      },
    });

    // Start the wallet
    await walletFacade.start(keys.shieldedSecretKeys, keys.dustSecretKey);

    // Background sync — transitions to 'ok' or 'ko'.
    // Awaits all sub-wallets (dust + shielded + unshielded) so the server can
    // safely build both shielded and unshielded offers once sync state is ok.
    walletFacade.waitForSyncedState().then(
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

    if (this.dustWalletSub) {
      this.dustWalletSub.unsubscribe();
      this.dustWalletSub = null;
    }
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
  
  public async getUnshieldedTokenBalances(): Promise<Record<string, bigint>> {
    const state = await this.walletConnection.walletFacade.unshielded.waitForSyncedState();
    return state.balances;
  }

  public balanceUnsealedTransaction(txHex: string): Promise<{ tx: string }> {
    return this.balanceFns.balanceUnsealedTransaction(txHex);
  }

  public balanceSealedTransaction(txHex: string): Promise<{ tx: string }> {
    return this.balanceFns.balanceSealedTransaction(txHex);
  }

  get shieldedPublicKeys() {
    const { shieldedSecretKeys } = this.walletConnection.keys;
    return {
      coinPublicKey: shieldedSecretKeys.coinPublicKey,
      encryptionPublicKey: shieldedSecretKeys.encryptionPublicKey,
    };
  }

  get syncState(): WalletSyncState {
    return this._syncState;
  }

  get state(): DustWalletState | null {
    return this.lastDustWalletState;
  }
}
