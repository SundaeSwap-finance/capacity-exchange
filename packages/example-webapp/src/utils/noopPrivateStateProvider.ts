import type { PrivateStateProvider } from '@midnight-ntwrk/midnight-js-types';

export function noopPrivateStateProvider(): PrivateStateProvider {
  const states = new Map<string, unknown>();
  const signingKeys = new Map<string, string>();

  return {
    async set(id, state) {
      states.set(id, state);
    },
    async get(id) {
      return states.get(id) ?? null;
    },
    async remove(id) {
      states.delete(id);
    },
    async clear() {
      states.clear();
    },
    async setSigningKey(address, key) {
      signingKeys.set(address as string, key);
    },
    async getSigningKey(address) {
      return signingKeys.get(address as string) ?? null;
    },
    async removeSigningKey(address) {
      signingKeys.delete(address as string);
    },
    async clearSigningKeys() {
      signingKeys.clear();
    },
  };
}
