import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { PrivateStateProvider } from '@midnight-ntwrk/midnight-js-types';

const DB_PATH = '.midnight-private-state';

export function createPrivateStateProvider(): PrivateStateProvider {
  console.error(`[PrivateStateProvider] Creating LevelDB provider at: ${DB_PATH}`);

  const provider = levelPrivateStateProvider({
    midnightDbName: DB_PATH,
    // Use a fixed password since we're in a dev/demo context
    privateStoragePasswordProvider: () => 'demo-password-for-local-dev',
  });

  // Wrap with logging
  return {
    set: async (id, state) => {
      console.error(`[PrivateStateProvider] SET: ${id}`);
      return provider.set(id, state);
    },
    get: async (id) => {
      const result = await provider.get(id);
      console.error(`[PrivateStateProvider] GET: ${id} -> ${result ? 'FOUND' : 'NOT FOUND'}`);
      return result;
    },
    remove: async (id) => {
      console.error(`[PrivateStateProvider] REMOVE: ${id}`);
      return provider.remove(id);
    },
    clear: async () => {
      console.error('[PrivateStateProvider] CLEAR');
      return provider.clear();
    },
    setSigningKey: async (addr, key) => {
      console.error(`[PrivateStateProvider] SET signing key for: ${addr}`);
      return provider.setSigningKey(addr, key);
    },
    getSigningKey: async (addr) => {
      const result = await provider.getSigningKey(addr);
      console.error(`[PrivateStateProvider] GET signing key for: ${addr} -> ${result ? 'FOUND' : 'NOT FOUND'}`);
      return result;
    },
    removeSigningKey: async (addr) => {
      console.error(`[PrivateStateProvider] REMOVE signing key for: ${addr}`);
      return provider.removeSigningKey(addr);
    },
    clearSigningKeys: async () => {
      console.error('[PrivateStateProvider] CLEAR signing keys');
      return provider.clearSigningKeys();
    },
  };
}
