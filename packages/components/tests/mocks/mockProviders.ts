import { vi } from 'vitest';
import type { WalletProvider, ProofProvider } from '@midnight-ntwrk/midnight-js-types';
import { ZKConfigProvider } from '@midnight-ntwrk/midnight-js-types';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import type { UnprovenTransaction, LedgerParameters } from '@midnight-ntwrk/ledger-v6';

export function createMockWalletProvider(): WalletProvider {
  return {
    getCoinPublicKey: () => 'mock-coin-public-key' as any,
    getEncryptionPublicKey: () => 'mock-encryption-public-key' as any,
    balanceTx: async () => {
      throw new Error('balanceTx should be replaced by withCapacityExchange');
    },
  };
}

export function createMockProofProvider(): ProofProvider<string> {
  return {
    proveTx: async (tx: UnprovenTransaction) => {
      // Return a mock proven transaction
      const mockProvenTx = {
        bind: () => ({
          merge: (dustTx: any) => ({
            serialize: () => new Uint8Array([1, 2, 3, 4, 5]),
          }),
        }),
      };
      return mockProvenTx as any;
    },
  } as ProofProvider<string>;
}

class MockZKConfigProvider extends ZKConfigProvider<string> {
  async getZKIR(): Promise<any> {
    return 'mock-zkir';
  }

  async getProverKey(): Promise<any> {
    return 'mock-prover-key';
  }

  async getVerifierKey(): Promise<any> {
    return 'mock-verifier-key';
  }
}

export function createMockZKConfigProvider(): ZKConfigProvider<string> {
  return new MockZKConfigProvider();
}

export function createMockConnectedAPI(): ConnectedAPI {
  return {
    balanceSealedTransaction: vi.fn().mockResolvedValue({
      tx: '0a0b0c0d0e0f',
    }),
    submitTransaction: vi.fn().mockResolvedValue(undefined),
    getShieldedAddresses: vi.fn().mockResolvedValue({
      shieldedAddress: 'mock-address',
      shieldedCoinPublicKey: 'mock-coin-key',
      shieldedEncryptionPublicKey: 'mock-enc-key',
    }),
    getConfiguration: vi.fn().mockResolvedValue({
      networkId: 'test-network',
      indexerUri: 'http://localhost:8080',
      indexerWsUri: 'ws://localhost:8080',
      substrateNodeUri: 'ws://localhost:9944',
    }),
  } as any;
}

export function createMockUnprovenTransaction(dustRequired: bigint = 50000n): UnprovenTransaction {
  return {
    feesWithMargin: (ledgerParams: LedgerParameters, multiplier: number) => dustRequired,
    serialize: () => new Uint8Array([1, 2, 3]),
  } as unknown as UnprovenTransaction;
}
