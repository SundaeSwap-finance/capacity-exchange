import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import type { WalletProvider, MidnightProvider } from '@midnight-ntwrk/midnight-js-types';
import type { UnboundTransaction } from '@midnight-ntwrk/midnight-js-types';
import type {
  CoinPublicKey,
  EncPublicKey,
  FinalizedTransaction,
  SignatureEnabled,
  Proof,
  Binding,
} from '@midnight-ntwrk/ledger-v8';
import { Transaction } from '@midnight-ntwrk/ledger-v8';
import { uint8ArrayToHex, hexToBytes } from './hex.js';

export interface BaseProviders {
  walletProvider: WalletProvider;
  midnightProvider: MidnightProvider;
}

export interface WalletIdentity {
  coinPublicKey: CoinPublicKey;
  encryptionPublicKey: EncPublicKey;
}

/**
 * Adapt a ConnectedAPI into WalletProvider + MidnightProvider.
 *
 * ConnectedAPI is the dapp-connector protocol used by browser extension wallets.
 * midnight-js contracts require WalletProvider/MidnightProvider, so this adapter
 * bridges the two.
 */
export function connectedApiProvidersAdapter(
  connectedAPI: ConnectedAPI,
  identity: WalletIdentity
): BaseProviders {
  const walletProvider: WalletProvider = {
    getCoinPublicKey(): CoinPublicKey {
      return identity.coinPublicKey;
    },
    getEncryptionPublicKey(): EncPublicKey {
      return identity.encryptionPublicKey;
    },
    async balanceTx(tx: UnboundTransaction): Promise<FinalizedTransaction> {
      const serialized = uint8ArrayToHex(tx.serialize());
      const result = await connectedAPI.balanceUnsealedTransaction(serialized);
      return Transaction.deserialize<SignatureEnabled, Proof, Binding>(
        'signature',
        'proof',
        'binding',
        hexToBytes(result.tx)
      ) as unknown as FinalizedTransaction;
    },
  };

  const midnightProvider: MidnightProvider = {
    async submitTx(tx: FinalizedTransaction): Promise<string> {
      await connectedAPI.submitTransaction(uint8ArrayToHex(tx.serialize()));
      return tx.identifiers()[0];
    },
  };

  return { walletProvider, midnightProvider };
}
