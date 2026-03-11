import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import type { SignatureEnabled, Proof, PreBinding, Binding } from '@midnight-ntwrk/ledger-v7';
import { Transaction } from '@midnight-ntwrk/ledger-v7';
import { MidnightBech32m } from '@midnight-ntwrk/wallet-sdk-address-format';
import { hexToBytes, uint8ArrayToHex } from './hex.js';
import { toNetworkIdEnum, resolveEndpoints } from './networks.js';
import { createWalletFromMnemonic, type CreateWalletFromMnemonicOptions } from './wallet.js';
import type { WalletConnection } from './walletFacade.js';
import type { StateStore } from './stateStore.js';

const DEFAULT_BALANCE_TTL_MS = 5 * 60 * 1000;

/** Create a ConnectedAPI from a mnemonic: parse seed, sync wallet, and build the adapter. */
export async function createConnectedAPIFromMnemonic(
  options: CreateWalletFromMnemonicOptions,
  store: StateStore
): Promise<ConnectedAPI> {
  const connection = await createWalletFromMnemonic(options, store);
  return createConnectedAPI(connection, options.networkId);
}

/**
 * Wrap a WalletConnection in the dapp-connector ConnectedAPI interface.
 * This lets mnemonic/seed-based wallets be used anywhere a browser extension wallet would be,
 * without consumers needing to know how the wallet was created.
 */
export function createConnectedAPI(connection: WalletConnection, networkId: string): ConnectedAPI {
  const { walletFacade, keys } = connection;
  const { shieldedSecretKeys, dustSecretKey } = keys;
  const enumId = toNetworkIdEnum(networkId);
  const endpoints = resolveEndpoints(enumId);

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
      return { balance: state.walletBalance(new Date()), cap: 0n };
    },
    async getShieldedAddresses() {
      const state = await walletFacade.shielded.waitForSyncedState();
      return {
        shieldedAddress: MidnightBech32m.encode(networkId, state.address).asString(),
        shieldedCoinPublicKey: state.coinPublicKey.toHexString(),
        shieldedEncryptionPublicKey: state.encryptionPublicKey.toHexString(),
      };
    },
    async getUnshieldedAddress() {
      const state = await walletFacade.unshielded.waitForSyncedState();
      return { unshieldedAddress: MidnightBech32m.encode(networkId, state.address).asString() };
    },
    async getDustAddress() {
      const state = await walletFacade.dust.waitForSyncedState();
      return { dustAddress: state.dustAddress };
    },
    async getTxHistory(): Promise<never[]> {
      return [];
    },
    async balanceUnsealedTransaction(txHex: string) {
      const txBytes = hexToBytes(txHex);
      const tx = Transaction.deserialize<SignatureEnabled, Proof, PreBinding>(
        'signature',
        'proof',
        'pre-binding',
        txBytes
      );
      const ttl = new Date(Date.now() + DEFAULT_BALANCE_TTL_MS);
      const recipe = await walletFacade.balanceUnboundTransaction(tx, { shieldedSecretKeys, dustSecretKey }, { ttl });
      const finalized = await walletFacade.finalizeRecipe(recipe);
      return { tx: uint8ArrayToHex(finalized.serialize()) };
    },
    async balanceSealedTransaction(txHex: string) {
      const txBytes = hexToBytes(txHex);
      const tx = Transaction.deserialize<SignatureEnabled, Proof, Binding>(
        'signature',
        'proof',
        'binding',
        txBytes
      ).bind();
      const ttl = new Date(Date.now() + DEFAULT_BALANCE_TTL_MS);
      const recipe = await walletFacade.balanceFinalizedTransaction(tx, { shieldedSecretKeys, dustSecretKey }, { ttl });
      const finalized = await walletFacade.finalizeRecipe(recipe);
      return { tx: uint8ArrayToHex(finalized.serialize()) };
    },
    async makeTransfer() {
      throw new Error('makeTransfer not implemented');
    },
    async makeIntent() {
      throw new Error('makeIntent not implemented');
    },
    async signData() {
      throw new Error('signData not implemented');
    },
    async submitTransaction(txHex: string) {
      const txBytes = hexToBytes(txHex);
      const tx = Transaction.deserialize<SignatureEnabled, Proof, Binding>(
        'signature',
        'proof',
        'binding',
        txBytes
      ).bind();
      await walletFacade.submitTransaction(tx);
    },
    async getProvingProvider() {
      throw new Error('getProvingProvider not implemented');
    },
    async getConfiguration() {
      return {
        indexerUri: endpoints.indexerHttpUrl,
        indexerWsUri: endpoints.indexerWsUrl,
        proverServerUri: endpoints.proofServerUrl,
        substrateNodeUri: endpoints.nodeUrl,
        networkId,
      };
    },
    async getConnectionStatus() {
      return { status: 'connected' as const, networkId };
    },
    async hintUsage() {},
  };
}
