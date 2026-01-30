import { ContractAddress, SigningKey } from '@midnight-ntwrk/compact-runtime';
import { PrivateStateProvider, PrivateStateId } from '@midnight-ntwrk/midnight-js-types';

export function createPrivateStateProvider(): PrivateStateProvider {
  const states = new Map<PrivateStateId, unknown>();
  const signingKeys = new Map<ContractAddress, SigningKey>();

  return {
    set: async (id, state) => {
      states.set(id, state);
    },
    get: async (id) => states.get(id) ?? null,
    remove: async (id) => {
      states.delete(id);
    },
    clear: async () => {
      states.clear();
    },
    setSigningKey: async (addr, key) => {
      signingKeys.set(addr, key);
    },
    getSigningKey: async (addr) => signingKeys.get(addr) ?? null,
    removeSigningKey: async (addr) => {
      signingKeys.delete(addr);
    },
    clearSigningKeys: async () => {
      signingKeys.clear();
    },
  };
}
