import type { PrivateStateProvider } from '@midnight-ntwrk/midnight-js-types';

export function inMemoryPrivateStateProvider(): PrivateStateProvider {
  const statesByContract = new Map<string, Map<string, unknown>>();
  const signingKeys = new Map<string, string>();
  let currentContract: string | undefined;

  function getContractStates(): Map<string, unknown> {
    const key = currentContract ?? '';
    let m = statesByContract.get(key);
    if (!m) {
      m = new Map();
      statesByContract.set(key, m);
    }
    return m;
  }

  return {
    setContractAddress(address) {
      currentContract = address as string;
    },
    async set(id, state) {
      getContractStates().set(id as string, state);
    },
    async get(id) {
      return getContractStates().get(id as string) ?? null;
    },
    async remove(id) {
      getContractStates().delete(id as string);
    },
    async clear() {
      getContractStates().clear();
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
    async exportPrivateStates() {
      throw new Error('exportPrivateStates not implemented for in-memory provider');
    },
    async importPrivateStates() {
      throw new Error('importPrivateStates not implemented for in-memory provider');
    },
    async exportSigningKeys() {
      throw new Error('exportSigningKeys not implemented for in-memory provider');
    },
    async importSigningKeys() {
      throw new Error('importSigningKeys not implemented for in-memory provider');
    },
  };
}
