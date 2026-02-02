import type { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { MidnightBech32m } from '@midnight-ntwrk/wallet-sdk-address-format';
import type { WalletCapabilities } from '../types';
import type { WalletKeys } from './walletService';

/**
 * Adapts a WalletFacade to the WalletCapabilities interface.
 */
export class SeedWalletAdapter implements WalletCapabilities {
  #walletFacade: WalletFacade;
  #keys: WalletKeys;
  #networkId: string;

  constructor(walletFacade: WalletFacade, keys: WalletKeys, networkId: string) {
    this.#walletFacade = walletFacade;
    this.#keys = keys;
    this.#networkId = networkId;
  }

  async getDustAddress(): Promise<{ dustAddress: string }> {
    const state = await this.#walletFacade.dust.waitForSyncedState();
    // DustWalletState.dustAddress is already a formatted string
    return { dustAddress: state.dustAddress };
  }

  async getDustBalance(): Promise<{ balance: bigint; cap: bigint }> {
    const state = await this.#walletFacade.dust.waitForSyncedState();
    const balance = state.walletBalance(new Date());
    // Cap is not directly available from the wallet state
    // Return 0n as placeholder - this would need proper calculation based on night balance
    return {
      balance,
      cap: 0n,
    };
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
}
