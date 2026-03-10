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
}

/** Returns a StateStore that prefixes all keys before delegating to the base store. */
export function withPrefix(base: StateStore, prefix: string): StateStore {
  const p = `${prefix}-`;
  return {
    save: (name, data) => base.save(`${p}${name}`, data),
    load: (name) => base.load(`${p}${name}`),
    clear: (name) => base.clear(`${p}${name}`),
  };
}
