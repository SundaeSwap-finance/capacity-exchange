import type { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { MidnightBech32m } from '@midnight-ntwrk/wallet-sdk-address-format';
import { combineLatest } from 'rxjs';
import type { BalanceUpdate, WalletCapabilities } from '../types';

/**
 * Adapts a WalletFacade to the WalletCapabilities interface.
 */
export class SeedWalletAdapter implements WalletCapabilities {
  #walletFacade: WalletFacade;
  #networkId: string;

  constructor(walletFacade: WalletFacade, networkId: string) {
    this.#walletFacade = walletFacade;
    this.#networkId = networkId;
  }

  async getDustAddress(): Promise<{ dustAddress: string }> {
    const state = await this.#walletFacade.dust.waitForSyncedState();
    return { dustAddress: MidnightBech32m.encode(this.#networkId, state.address).asString() };
  }

  async getDustBalance(): Promise<{ balance: bigint }> {
    const state = await this.#walletFacade.dust.waitForSyncedState();
    const balance = state.balance(new Date());
    return { balance };
  }

  async getShieldedAddresses(): Promise<{
    shieldedAddress: string;
    shieldedCoinPublicKey: string;
    shieldedEncryptionPublicKey: string;
  }> {
    const state = await this.#walletFacade.shielded.waitForSyncedState();
    const shieldedAddress = MidnightBech32m.encode(this.#networkId, state.address).asString();

    return {
      shieldedAddress,
      shieldedCoinPublicKey: state.coinPublicKey.toHexString(),
      shieldedEncryptionPublicKey: state.encryptionPublicKey.toHexString(),
    };
  }

  async getUnshieldedAddress(): Promise<{ unshieldedAddress: string }> {
    // Don't wait for unshielded sync — we don't use it in the demo
    return { unshieldedAddress: '' };
  }

  async getUnshieldedBalances(): Promise<Record<string, bigint>> {
    return {};
  }

  async getShieldedBalances(): Promise<Record<string, bigint>> {
    const state = await this.#walletFacade.shielded.waitForSyncedState();
    return state.balances;
  }

  subscribeToBalances(callback: (update: BalanceUpdate) => void): () => void {
    // Emit current balances immediately so callers don't wait for next state change
    this.#emitCurrentBalances(callback);

    const subscription = combineLatest([this.#walletFacade.dust.state, this.#walletFacade.shielded.state]).subscribe({
      next: ([dustState, shieldedState]) => {
        callback({
          status: 'success',
          data: {
            dustBalance: dustState.balance(new Date()),
            nightBalances: {},
            shieldedBalances: shieldedState.balances,
          },
        });
      },
      error: (err) => {
        callback({ status: 'error', error: err instanceof Error ? err.message : 'Unknown error' });
      },
    });

    return () => subscription.unsubscribe();
  }

  #emitCurrentBalances(callback: (update: BalanceUpdate) => void): void {
    Promise.all([this.getDustBalance(), this.getShieldedBalances()])
      .then(([dust, shielded]) => {
        callback({
          status: 'success',
          data: {
            dustBalance: dust.balance,
            nightBalances: {},
            shieldedBalances: shielded,
          },
        });
      })
      .catch(() => {});
  }
}
