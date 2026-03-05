/**
 * Platform-agnostic key-value store for serialized wallet state.
 *
 * Implementations exist for Node (file-backed) and browser (localStorage-backed).
 */
export interface StateStore {
  /** Write `data` under the given key. */
  save(name: string, data: string | Uint8Array): Promise<void>;

  /** Read previously saved state, or `undefined` if none exists. */
  load(name: string): Promise<string | undefined>;

  /** Delete a single key's state. */
  clear(name: string): Promise<void>;

  /** Flush any pending writes. No-op for non-buffered stores. */
  flush(): Promise<void>;
}

/** Returns a StateStore that prefixes all keys before delegating to the base store. */
export function withPrefix(base: StateStore, prefix: string): StateStore {
  const p = `${prefix}-`;
  return {
    save: (name, data) => base.save(`${p}${name}`, data),
    load: (name) => base.load(`${p}${name}`),
    clear: (name) => base.clear(`${p}${name}`),
    flush: () => base.flush(),
  };
}

/** Returns a StateStore that debounces save() calls, flushing after the given interval.
 *  Useful for server contexts with ongoing state persistence, not one-shot CLI/webapp syncs. */
export function withDebounce(base: StateStore, debounceMs: number = 1000): StateStore {
  const pending = new Map<string, string | Uint8Array>();
  let timeout: NodeJS.Timeout | null = null;

  async function flush(): Promise<void> {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
    const entries = [...pending.entries()];
    pending.clear();
    await Promise.all(entries.map(([name, data]) => base.save(name, data)));
  }

  function scheduleSave(name: string, data: string | Uint8Array): Promise<void> {
    pending.set(name, data);
    if (!timeout) {
      timeout = setTimeout(() => {
        timeout = null;
        void flush();
      }, debounceMs);
    }
    return Promise.resolve();
  }

  return {
    save: scheduleSave,
    load: (name) => base.load(name),
    clear: (name) => {
      pending.delete(name);
      return base.clear(name);
    },
    flush,
  };
}
