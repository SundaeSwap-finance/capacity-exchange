import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import {
  createLedger9MidnightProvider,
  createLedger9WalletProvider,
  type WalletProvider,
  type MidnightProvider,
} from '@midnight-ntwrk/midnight-js/types';
import type { CoinPublicKey, EncPublicKey } from '@midnightntwrk/ledger-v9';
import { uint8ArrayToHex, hexToBytes } from './hex.js';
import { toFinalized } from './walletTx.js';

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
 * bridges the two. Transactions cross the connector as hex, so both serve ledger-v9 only.
 */
export function connectedApiProvidersAdapter(connectedAPI: ConnectedAPI, identity: WalletIdentity): BaseProviders {
  const walletProvider = createLedger9WalletProvider({
    getCoinPublicKey: () => identity.coinPublicKey,
    getEncryptionPublicKey: () => identity.encryptionPublicKey,
    async balanceTx(tx) {
      const result = await connectedAPI.balanceUnsealedTransaction(uint8ArrayToHex(tx.serialize()), {
        payFees: false,
      });
      return hexToBytes(result.tx);
    },
  });

  const midnightProvider = createLedger9MidnightProvider(async (tx) => {
    await connectedAPI.submitTransaction(uint8ArrayToHex(tx.serialize()));
    return toFinalized(tx).identifiers()[0];
  });

  return { walletProvider, midnightProvider };
}
