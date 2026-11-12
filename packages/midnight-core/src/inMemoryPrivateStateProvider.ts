import type { ContractPrivateStates, PrivateStateProvider } from '@midnight-ntwrk/midnight-js/types';
import type { SigningKey } from '@midnight-ntwrk/compact-runtime';

export function inMemoryPrivateStateProvider(): PrivateStateProvider {
  const statesByContract = new Map<string, Map<string, unknown>>();
  const signingKeys = new Map<string, SigningKey>();

  function statesOf(contractAddress: string): Map<string, unknown> {
    let m = statesByContract.get(contractAddress);
    if (!m) {
      m = new Map();
      statesByContract.set(contractAddress, m);
    }
    return m;
  }

  return {
    forContract(contractAddress): ContractPrivateStates {
      const states = statesOf(contractAddress);
      return {
        contractAddress,
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
        async exportPrivateStates() {
          throw new Error('exportPrivateStates not implemented for in-memory provider');
        },
        async importPrivateStates() {
          throw new Error('importPrivateStates not implemented for in-memory provider');
        },
      };
    },
    async clearAll() {
      for (const states of statesByContract.values()) {
        states.clear();
      }
    },
    async setSigningKey(address, key) {
      signingKeys.set(address, key);
    },
    async getSigningKey(address) {
      return signingKeys.get(address) ?? null;
    },
    async removeSigningKey(address) {
      signingKeys.delete(address);
    },
    async clearSigningKeys() {
      signingKeys.clear();
    },
    async exportSigningKeys() {
      throw new Error('exportSigningKeys not implemented for in-memory provider');
    },
    async importSigningKeys() {
      throw new Error('importSigningKeys not implemented for in-memory provider');
    },
  };
}
