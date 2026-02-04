import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import type { WalletCapabilities, BalanceUpdate, BalanceData } from '../types';

const DEFAULT_POLL_INTERVAL = 5000;

export class ExtensionWalletAdapter implements WalletCapabilities {
  #wallet: ConnectedAPI;
  #pollInterval: number;

  constructor(wallet: ConnectedAPI, pollInterval = DEFAULT_POLL_INTERVAL) {
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

  getShieldedAddresses() {
    return this.#wallet.getShieldedAddresses();
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
