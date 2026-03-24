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
    const state = await this.#walletFacade.unshielded.waitForSyncedState();
    const unshieldedAddress = MidnightBech32m.encode(this.#networkId, state.address).asString();
    return { unshieldedAddress };
  }

  async getUnshieldedBalances(): Promise<Record<string, bigint>> {
    const state = await this.#walletFacade.unshielded.waitForSyncedState();
    return state.balances;
  }

  async getShieldedBalances(): Promise<Record<string, bigint>> {
    const state = await this.#walletFacade.shielded.waitForSyncedState();
    return state.balances;
  }

  subscribeToBalances(callback: (update: BalanceUpdate) => void): () => void {
    const subscription = combineLatest([
      this.#walletFacade.dust.state,
      this.#walletFacade.unshielded.state,
      this.#walletFacade.shielded.state,
    ]).subscribe({
      next: ([dustState, unshieldedState, shieldedState]) => {
        callback({
          status: 'success',
          data: {
            dustBalance: dustState.balance(new Date()),
            nightBalances: unshieldedState.balances,
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
}
