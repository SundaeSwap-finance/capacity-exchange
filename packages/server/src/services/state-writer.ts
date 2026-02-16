import { writeFile, rename } from 'node:fs/promises';
import { FastifyBaseLogger } from 'fastify';

export interface Serializable {
  serialize(): string | Uint8Array;
}

export interface StateHasher<T> {
  hash(state: T): string;
}

/**
 * Handles debounced async writes of serializable state to disk.
 * Prevents excessive disk I/O when state changes frequently.
 */
export class StateWriter<T extends Serializable> {
  readonly #logger: FastifyBaseLogger;
  readonly #filePath: string;
  readonly #hasher: StateHasher<T>;
  readonly #debounceMs: number;

  #pendingState: T | null = null;
  #writeTimeout: NodeJS.Timeout | null = null;
  #lastWrittenStateHash: string | null = null;

  constructor(
    filePath: string,
    hasher: StateHasher<T>,
    logger: FastifyBaseLogger,
    debounceMs: number = 1000,
  ) {
    this.#filePath = filePath;
    this.#hasher = hasher;
    this.#logger = logger;
    this.#debounceMs = debounceMs;
  }

  /**
   * Schedule a debounced write. If a write is already scheduled,
   * this just updates the pending state without scheduling another.
   */
  schedule(state: T): void {
    this.#pendingState = state;

    if (this.#writeTimeout) {
      return; // Already scheduled
    }

    this.#writeTimeout = setTimeout(() => {
      this.#writeTimeout = null;
      this.flush();
    }, this.#debounceMs);
  }

  /**
   * Immediately flush any pending state to disk.
   * Cancels any scheduled write and writes the current pending state.
   */
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

    // Skip if state hasn't changed
    const stateHash = this.#hasher.hash(state);
    if (stateHash === this.#lastWrittenStateHash) {
      return;
    }

    try {
      const serialized = state.serialize();
      const tempPath = `${this.#filePath}.${Date.now()}.tmp`;
      await writeFile(tempPath, serialized);
      await rename(tempPath, this.#filePath);
      this.#lastWrittenStateHash = stateHash;
      this.#logger.debug('State persisted');
    } catch (err) {
      this.#logger.error(err, 'Failed to persist state');
    }
  }
}
