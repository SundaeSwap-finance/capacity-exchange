import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { encodeShieldedAddress } from '@capacity-exchange/core';
import type { WalletCapabilities, BalanceUpdate, BalanceData } from '../types';

const DEFAULT_POLL_INTERVAL = 5000;

export class ExtensionWalletAdapter implements WalletCapabilities {
  #networkId: string;
  #wallet: ConnectedAPI;
  #pollInterval: number;

  constructor(networkId: string, wallet: ConnectedAPI, pollInterval = DEFAULT_POLL_INTERVAL) {
    this.#networkId = networkId;
    this.#wallet = wallet;
    this.#pollInterval = pollInterval;
  }

  getDustAddress() {
    return this.#wallet.getDustAddress();
  }

  async getDustBalance() {
    const { balance } = await this.#wallet.getDustBalance();
    return { balance };
  }

  async getShieldedAddresses() {
    const result = await this.#wallet.getShieldedAddresses();
    // TODO(SUNDAE-2364): Use result.shieldedAddress directly once Lace returns bech32m instead of raw hex
    const encoded = encodeShieldedAddress(
      this.#networkId,
      result.shieldedCoinPublicKey,
      result.shieldedEncryptionPublicKey
    );
    if (!encoded.ok) {
      throw new Error(encoded.error);
    }
    return { ...result, shieldedAddress: encoded.address };
  }

  getShieldedBalances() {
    return this.#wallet.getShieldedBalances();
  }

  getUnshieldedAddress() {
    return this.#wallet.getUnshieldedAddress();
  }

  getUnshieldedBalances() {
    return this.#wallet.getUnshieldedBalances();
  }

  async #fetchBalances(): Promise<BalanceData> {
    const [dust, unshielded, shielded] = await Promise.all([
      this.#wallet.getDustBalance(),
      this.#wallet.getUnshieldedBalances(),
      this.#wallet.getShieldedBalances(),
    ]);

    return {
      dustBalance: dust.balance,
      nightBalances: unshielded,
      shieldedBalances: shielded,
    };
  }

  subscribeToBalances(callback: (update: BalanceUpdate) => void): () => void {
    let cancelled = false;

    const poll = async () => {
      if (cancelled) {
        return;
      }

      try {
        const data = await this.#fetchBalances();
        if (!cancelled) {
          callback({ status: 'success', data });
        }
      } catch (err) {
        if (!cancelled) {
          callback({ status: 'error', error: err instanceof Error ? err.message : 'Unknown error' });
        }
      }

      if (!cancelled) {
        setTimeout(poll, this.#pollInterval);
      }
    };

    poll();

    return () => {
      cancelled = true;
    };
  }
}
