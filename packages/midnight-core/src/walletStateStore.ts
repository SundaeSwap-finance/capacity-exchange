import type { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import type { StateStore } from './stateStore';
import { withPrefix } from './stateStore';

const WALLET_STATE_KEYS = ['shielded', 'unshielded', 'dust'] as const;

export interface SavedWalletState {
  savedShieldedState?: string;
  savedUnshieldedState?: string;
  savedDustState?: string;
}

/** Wallet state scoped to a specific network and wallet identity. */
export class WalletStateStore {
  readonly #store: StateStore;

  constructor(base: StateStore, networkId: string, coinPublicKey: string) {
    this.#store = withPrefix(base, `${networkId}-${coinPublicKey}`);
  }

  async loadWalletState(): Promise<SavedWalletState> {
    const [savedShieldedState, savedUnshieldedState, savedDustState] = await Promise.all(
      WALLET_STATE_KEYS.map((k) => this.#store.load(k))
    );
    return { savedShieldedState, savedUnshieldedState, savedDustState };
  }

  async saveWalletState(facade: WalletFacade): Promise<void> {
    const [shieldedState, unshieldedState, dustState] = await Promise.all([
      facade.shielded.serializeState(),
      facade.unshielded.serializeState(),
      facade.dust.serializeState(),
    ]);
    await Promise.all(
      [shieldedState, unshieldedState, dustState].map((data, i) => this.#store.save(WALLET_STATE_KEYS[i], data))
    );
  }

  async clearAll(): Promise<void> {
    await Promise.all(WALLET_STATE_KEYS.map((k) => this.#store.clear(k)));
  }

  flush(): Promise<void> {
    return this.#store.flush();
  }
}
