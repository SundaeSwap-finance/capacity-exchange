import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import type {
  ZswapSecretKeys,
  DustSecretKey,
  SignatureEnabled,
  Proof,
  Binding,
  FinalizedTransaction,
} from '@midnight-ntwrk/ledger-v6';
import { Transaction } from '@midnight-ntwrk/ledger-v6';
import type { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import type { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import type { Config } from '../../config';
import type { ShieldedAddressInfo } from './createBrowserProviders';
import { hexToUint8Array, uint8ArrayToHex } from '../../utils/hex';

/**
 * Creates a ConnectedAPI adapter for seed wallets.
 * Implements the subset of ConnectedAPI needed for CES flow.
 */
export function createSeedWalletConnectedAPIAdapter(
  walletFacade: WalletFacade,
  shieldedSecretKeys: ZswapSecretKeys,
  dustSecretKey: DustSecretKey,
  shieldedAddress: ShieldedAddressInfo,
  unshieldedAddress: string,
  dustAddress: string,
  config: Config
): ConnectedAPI {
  return {
    async getShieldedBalances() {
      const state = await walletFacade.shielded.waitForSyncedState();
      return state.balances;
    },

    async getUnshieldedBalances() {
      const state = await walletFacade.unshielded.waitForSyncedState();
      return state.balances;
    },

    async getDustBalance() {
      const state = await walletFacade.dust.waitForSyncedState();
      const balance = state.walletBalance(new Date());
      return { balance, cap: 0n };
    },

    async getShieldedAddresses() {
      return shieldedAddress;
    },

    async getUnshieldedAddress() {
      return { unshieldedAddress };
    },

    async getDustAddress() {
      return { dustAddress };
    },

    async getTxHistory() {
      return [];
    },

    async balanceUnsealedTransaction(_tx: string) {
      throw new Error('balanceUnsealedTransaction not implemented for seed wallet');
    },

    async balanceSealedTransaction(txHex: string) {
      const txBytes = hexToUint8Array(txHex);
      const tx = Transaction.deserialize<SignatureEnabled, Proof, Binding>(
        'signature',
        'proof',
        'binding',
        txBytes
      ).bind();

      const shieldedWallet = walletFacade.shielded;
      const recipe = await shieldedWallet.balanceTransaction(shieldedSecretKeys, tx, []);

      const dustWallet = walletFacade.dust as DustWallet;
      const finalized = await dustWallet.finalizeTransaction(recipe);

      const serialized = finalized.serialize();
      return { tx: uint8ArrayToHex(serialized) };
    },

    async makeTransfer() {
      throw new Error('makeTransfer not implemented for seed wallet');
    },

    async makeIntent() {
      throw new Error('makeIntent not implemented for seed wallet');
    },

    async signData() {
      throw new Error('signData not implemented for seed wallet');
    },

    async submitTransaction(txHex: string) {
      const txBytes = hexToUint8Array(txHex);
      const tx = Transaction.deserialize<SignatureEnabled, Proof, Binding>(
        'signature',
        'proof',
        'binding',
        txBytes
      ).bind();

      await walletFacade.submitTransaction(tx as unknown as FinalizedTransaction);
    },

    async getProvingProvider() {
      throw new Error('getProvingProvider not implemented for seed wallet');
    },

    async getConfiguration() {
      return {
        indexerUri: config.indexerUrl,
        indexerWsUri: config.indexerWsUrl,
        proverServerUri: config.proofServerUrl,
        substrateNodeUri: config.nodeWsUrl,
        networkId: config.networkId,
      };
    },

    async getConnectionStatus() {
      return { status: 'connected' as const, networkId: config.networkId };
    },

    async hintUsage() {
      // No-op for seed wallet
    },
  };
}
