import type { WalletProvider, MidnightProvider } from '@midnight-ntwrk/midnight-js-types';
import type { UnboundTransaction } from '@midnight-ntwrk/midnight-js-types';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import type { FinalizedTransaction, CoinPublicKey, EncPublicKey } from '@midnight-ntwrk/ledger-v7';
import { uint8ArrayToHex } from '@capacity-exchange/midnight-core';

export interface BrowserProviders {
  walletProvider: WalletProvider;
  connectedAPI: ConnectedAPI;
  midnightProvider: MidnightProvider;
}

export interface ShieldedAddressInfo {
  shieldedAddress: string;
  shieldedCoinPublicKey: string;
  shieldedEncryptionPublicKey: string;
}

export function createBrowserProviders(
  connectedAPI: ConnectedAPI,
  shieldedAddress: ShieldedAddressInfo
): BrowserProviders {
  const walletProvider: WalletProvider = {
    getCoinPublicKey(): CoinPublicKey {
      return shieldedAddress.shieldedCoinPublicKey as CoinPublicKey;
    },
    getEncryptionPublicKey(): EncPublicKey {
      return shieldedAddress.shieldedEncryptionPublicKey as EncPublicKey;
    },
    async balanceTx(_tx: UnboundTransaction, _ttl?: Date) {
      throw new Error('balanceTx should be handled by capacityExchangeWalletProvider');
    },
  };

  const midnightProvider: MidnightProvider = {
    async submitTx(tx: FinalizedTransaction): Promise<string> {
      const serialized = tx.serialize();
      await connectedAPI.submitTransaction(uint8ArrayToHex(serialized));
      return tx.identifiers()[0];
    },
  };

  return { walletProvider, connectedAPI, midnightProvider };
}
