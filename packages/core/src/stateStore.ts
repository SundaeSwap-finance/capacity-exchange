import { createHash } from 'node:crypto';
import { writeFile, readFile, rename, unlink, readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { NetworkId } from '@midnight-ntwrk/wallet-sdk-abstractions';
import type { Logger } from './logger';

/**
 * File-backed key-value store for serialized state.
 *
 * Files are stored in a single directory and namespaced by a suffix so
 * multiple independent consumers can share the same directory. Writes use
 * a temp-file-then-rename strategy to avoid partial reads.
 */
export class StateStore {
  readonly #dir: string;
  readonly #suffix: string;
  readonly #logger: Logger;

  /**
   * @param dir - Directory where state files are stored (created on first write).
   * @param suffix - Namespace suffix appended to filenames, so multiple stores can share a directory.
   * @param logger - Logger for debug and error messages.
   */
  constructor(dir: string, suffix: string, logger: Logger) {
    this.#dir = dir;
    this.#suffix = suffix;
    this.#logger = logger;
  }

  /** Write `data` to disk under the given key, atomically. */
  async save(name: string, data: string | Uint8Array): Promise<void> {
    await mkdir(this.#dir, { recursive: true });
    const filePath = this.#filePath(name);
    const tempPath = `${filePath}.${Date.now()}.tmp`;
    await writeFile(tempPath, data);
    await rename(tempPath, filePath);
    this.#logger.debug(`Saved state '${name}'`);
  }

  /** Read previously saved state, or `undefined` if none exists. */
  async load(name: string): Promise<string | undefined> {
    try {
      const data = await readFile(this.#filePath(name), 'utf-8');
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

  /** Delete all state files matching this store's suffix. */
  async clearAll(): Promise<void> {
    try {
      const files = await readdir(this.#dir);
      const matching = files.filter((f) => f.endsWith(`-${this.#suffix}.data`));
      await Promise.all(matching.map((f) => unlink(path.join(this.#dir, f)).catch(() => {})));
      this.#logger.debug(`Cleared all state (${matching.length} files)`);
    } catch {
      // Ignore if dir missing
    }
  }

  #filePath(name: string): string {
    return path.join(this.#dir, `${name}-${this.#suffix}.data`);
  }
}

/**
 * Create a {@link StateStore} for wallet state, namespaced by network and seed.
 *
 * The suffix is a truncated SHA-256 hash of `network + seedHex`, so the same
 * seed on different networks gets separate state files.
 */
export function createWalletStateStore(
  networkId: NetworkId.NetworkId,
  seedHex: string,
  logger: Logger,
  dir: string
): StateStore {
  const suffix = createHash('sha256')
    .update(String(networkId) + seedHex)
    .digest('hex')
    .slice(0, 12);
  return new StateStore(dir, suffix, logger);
}
