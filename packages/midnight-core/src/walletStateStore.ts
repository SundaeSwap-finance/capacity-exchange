import type { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import type { StateStore } from './stateStore';
import { withPrefix } from './stateStore';

const WALLET_STATE_KEYS = ['shielded', 'unshielded', 'dust'] as const;

export interface SavedWalletState {
  savedShieldedState?: string;
  savedUnshieldedState?: string;
  savedDustState?: string;
}

export interface WalletStateStoreOptions {
  /** Debounce interval for saveWalletState in ms. 0 = write immediately. */
  debounceMs?: number;
  /** Called when a debounced flush fails. */
  onFlushError?: (err: unknown) => void;
}

/** Wallet state scoped to a specific network and wallet identity. */
export class WalletStateStore {
  readonly #store: StateStore;
  readonly #debounceMs: number;
  readonly #onFlushError: (err: unknown) => void;
  #pendingFacade: WalletFacade | null = null;
  #timeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    base: StateStore,
    networkId: string,
    coinPublicKey: string,
    options?: WalletStateStoreOptions,
  ) {
    this.#store = withPrefix(base, `${networkId}-${coinPublicKey}`);
    this.#debounceMs = options?.debounceMs ?? 0;
    this.#onFlushError = options?.onFlushError ?? (() => {});
  }

  async loadWalletState(): Promise<SavedWalletState> {
    const [savedShieldedState, savedUnshieldedState, savedDustState] = await Promise.all(
      WALLET_STATE_KEYS.map((k) => this.#store.load(k)),
    );
    return { savedShieldedState, savedUnshieldedState, savedDustState };
  }

  /** Save wallet state. When debounceMs > 0, serialization and write are deferred
   *  and the returned promise resolves immediately. */
  async saveWalletState(facade: WalletFacade): Promise<void> {
    if (this.#debounceMs <= 0) {
      await this.#doSave(facade);
      return;
    }
    this.#pendingFacade = facade;
    if (!this.#timeout) {
      this.#timeout = setTimeout(() => {
        this.#timeout = null;
        this.flush().catch(this.#onFlushError);
      }, this.#debounceMs);
    }
  }

  /** Flush any pending debounced save immediately. */
  async flush(): Promise<void> {
    if (this.#timeout) {
      clearTimeout(this.#timeout);
      this.#timeout = null;
    }
    const facade = this.#pendingFacade;
    if (!facade) return;
    this.#pendingFacade = null;
    await this.#doSave(facade);
  }

  async #doSave(facade: WalletFacade): Promise<void> {
    const [shieldedState, unshieldedState, dustState] = await Promise.all([
      facade.shielded.serializeState(),
      facade.unshielded.serializeState(),
      facade.dust.serializeState(),
    ]);
    await Promise.all(
      [shieldedState, unshieldedState, dustState].map((data, i) =>
        this.#store.save(WALLET_STATE_KEYS[i], data),
      ),
    );
  }

  async clearAll(): Promise<void> {
    await Promise.all(WALLET_STATE_KEYS.map((k) => this.#store.clear(k)));
  }
}
