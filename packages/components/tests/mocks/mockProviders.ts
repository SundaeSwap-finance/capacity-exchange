import type { WalletProvider } from '@midnight-ntwrk/midnight-js-types';
import type { UnboundTransaction } from '@midnight-ntwrk/midnight-js-types';
import type { LedgerParameters } from '@midnight-ntwrk/ledger-v7';

export function createMockWalletProvider(): WalletProvider {
  return {
    getCoinPublicKey: () => 'mock-coin-public-key' as any,
    getEncryptionPublicKey: () => 'mock-encryption-public-key' as any,
    balanceTx: async () => {
      throw new Error('balanceTx should be replaced by withCapacityExchange');
    },
  };
}

export function createMockUnboundTransaction(dustRequired: bigint = 50000n): UnboundTransaction {
  return {
    feesWithMargin: (ledgerParams: LedgerParameters, multiplier: number) => dustRequired,
    identifiers: () => ['mock-tx-id'],
    bind: () => ({
      merge: (dustTx: any) => ({
        serialize: () => new Uint8Array([1, 2, 3, 4, 5]),
      }),
    }),
    serialize: () => new Uint8Array([1, 2, 3]),
  } as unknown as UnboundTransaction;
}
