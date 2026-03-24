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

export interface ConnectedApiProviders {
  connectedAPI: ConnectedAPI;
  walletProvider: WalletProvider;
  midnightProvider: MidnightProvider;
}

export interface ShieldedAddressInfo {
  shieldedAddress: string;
  shieldedCoinPublicKey: string;
  shieldedEncryptionPublicKey: string;
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
  shieldedAddress: ShieldedAddressInfo
): ConnectedApiProviders {
  const walletProvider: WalletProvider = {
    getCoinPublicKey(): CoinPublicKey {
      return shieldedAddress.shieldedCoinPublicKey as CoinPublicKey;
    },
    getEncryptionPublicKey(): EncPublicKey {
      return shieldedAddress.shieldedEncryptionPublicKey as EncPublicKey;
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

  return { connectedAPI, walletProvider, midnightProvider };
}
