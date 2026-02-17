import { StateStore } from './stateStore';
import type { Logger } from './logger';

export interface Serializable {
  serialize(): string | Uint8Array;
}

/**
 * Debounces writes of serializable state to a {@link StateStore}.
 *
 * Each call to {@link schedule} captures the latest state and starts (or resets)
 * a debounce timer. {@link flush} writes immediately, cancelling any pending timer.
 */
export class StateWriter<T extends Serializable> {
  readonly #store: StateStore;
  readonly #name: string;
  readonly #stateKey: (state: T) => string;
  readonly #logger: Logger;
  readonly #debounceMs: number;

  #pendingState: T | null = null;
  #writeTimeout: NodeJS.Timeout | null = null;
  #lastWrittenStateKey: string | null = null;

  /**
   * @param store - The backing store to persist state to.
   * @param name - Key under which state is saved in the store.
   * @param stateKey - Produces a key string from state; used to skip redundant writes when the key hasn't changed.
   * @param logger - Logger for debug and error messages.
   * @param debounceMs - Delay in milliseconds before a scheduled write fires (default 1000).
   */
  constructor(
    store: StateStore,
    name: string,
    stateKey: (state: T) => string,
    logger: Logger,
    debounceMs: number = 1000
  ) {
    this.#store = store;
    this.#name = name;
    this.#stateKey = stateKey;
    this.#logger = logger;
    this.#debounceMs = debounceMs;
  }

  /** Enqueue state to be written after the debounce interval. */
  schedule(state: T): void {
    this.#pendingState = state;

    // Timer already running — the pending state will be picked up when it fires.
    if (this.#writeTimeout) {
      return;
    }

    this.#writeTimeout = setTimeout(() => {
      this.#writeTimeout = null;
      this.flush();
    }, this.#debounceMs);
  }

  /** Write any pending state immediately, cancelling the debounce timer. */
  async flush(): Promise<void> {
    if (this.#writeTimeout) {
      clearTimeout(this.#writeTimeout);
      this.#writeTimeout = null;
    }

    const state = this.#pendingState;
    if (!state) {
      return;
    }

    this.#pendingState = null;

    // Skip the write if nothing actually changed since the last persist.
    const key = this.#stateKey(state);
    if (key === this.#lastWrittenStateKey) {
      return;
    }

    try {
      const serialized = state.serialize();
      await this.#store.save(this.#name, serialized);
      this.#lastWrittenStateKey = key;
    } catch (err) {
      this.#logger.error(err, 'Failed to persist state');
    }
  }
}
