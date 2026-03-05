import type { StateStore } from './stateStore';

/** Browser-compatible StateStore backed by localStorage. */
export class LocalStorageStateStore implements StateStore {
  async save(name: string, data: string | Uint8Array): Promise<void> {
    const value = typeof data === 'string' ? data : new TextDecoder().decode(data);
    localStorage.setItem(name, value);
  }

  async load(name: string): Promise<string | undefined> {
    return localStorage.getItem(name) ?? undefined;
  }

  async clear(name: string): Promise<void> {
    localStorage.removeItem(name);
  }

  async flush(): Promise<void> {}
}
