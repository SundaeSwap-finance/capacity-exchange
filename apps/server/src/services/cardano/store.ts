import { FastifyBaseLogger } from 'fastify';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import * as path from 'node:path';

export interface StateStore {
  /** Write `data` under the given key. */
  save(name: string, data: Uint8Array): Promise<void>;

  /** Read previously saved state, or `undefined` if none exists. */
  load(name: string): Promise<Uint8Array | undefined>;

  /** Delete a single key's state. */
  clear(name: string): Promise<void>;
}

/**
 * File-backed StateStore implementation.
 *
 * Each key maps to a `.data` file in the configured directory.
 * Writes use a temp-file-then-rename strategy to avoid partial reads.
 */
export class FileStateStore implements StateStore {
  readonly #dir: string;
  readonly #logger: FastifyBaseLogger;

  /**
   * @param dir - Directory where state files are stored (created on first write).
   * @param logger - Logger for debug and error messages.
   */
  constructor(dir: string, logger: FastifyBaseLogger) {
    this.#dir = dir;
    this.#logger = logger;
  }

  /** Write `data` to disk under the given key, atomically. */
  async save(name: string, data: Uint8Array): Promise<void> {
    await mkdir(this.#dir, { recursive: true });
    const filePath = this.#filePath(name);
    const tempPath = `${filePath}.${Date.now()}.tmp`;
    await writeFile(tempPath, data);
    await rename(tempPath, filePath);
    this.#logger.debug(`Saved state '${name}'`);
  }

  /** Read previously saved state, or `undefined` if none exists. */
  async load(name: string): Promise<Uint8Array | undefined> {
    try {
      const data = await readFile(this.#filePath(name));
      this.#logger.debug(`Loaded state '${name}'`);
      return data;
    } catch (err) {
      const nodeErr = err as NodeJS.ErrnoException;
      if (nodeErr?.code === 'ENOENT') {
        this.#logger.debug(`No saved state for '${name}'`);
        return undefined;
      }
      throw err;
    }
  }

  /** Delete a single key's state file, if it exists. */
  async clear(name: string): Promise<void> {
    try {
      await unlink(this.#filePath(name));
      this.#logger.debug(`Cleared state '${name}'`);
    } catch {
      // Ignore if missing
    }
  }

  #filePath(name: string): string {
    return path.join(this.#dir, `${name}.data`);
  }
}

/** For tests */
export class InMemoryStateStore implements StateStore {
  #state = new Map<string, Uint8Array>();

  async save(name: string, data: Uint8Array): Promise<void> {
    this.#state.set(name, data);
  }

  async load(name: string): Promise<Uint8Array | undefined> {
    return this.#state.get(name);
  }

  async clear(name: string): Promise<void> {
    this.#state.delete(name);
  }
}
