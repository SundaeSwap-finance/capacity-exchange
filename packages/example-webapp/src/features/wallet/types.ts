import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import type { ZswapSecretKeys, DustSecretKey } from '@midnight-ntwrk/ledger-v6';
import type { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';

export interface BalanceData {
  dustBalance: bigint;
  nightBalances: Record<string, bigint>;
  shieldedBalances: Record<string, bigint>;
}

export type BalanceUpdate = { status: 'success'; data: BalanceData } | { status: 'error'; error: string };

/**
 * Common wallet capabilities interface.
 */
export interface WalletCapabilities {
  getDustAddress(): Promise<{ dustAddress: string }>;
  getDustBalance(): Promise<{ balance: bigint }>;
  getShieldedAddresses(): Promise<{
    shieldedAddress: string;
    shieldedCoinPublicKey: string;
    shieldedEncryptionPublicKey: string;
  }>;
  getShieldedBalances(): Promise<Record<string, bigint>>;
  getUnshieldedAddress(): Promise<{ unshieldedAddress: string }>;
  getUnshieldedBalances(): Promise<Record<string, bigint>>;
  subscribeToBalances(callback: (update: BalanceUpdate) => void): () => void;
}

export interface WalletData {
  unshieldedAddress: string;
  shieldedAddress: string;
  dustAddress: string;
  dustBalance: bigint;
  nightBalances: Record<string, bigint>;
  shieldedBalances: Record<string, bigint>;
}

export type WalletInfoState =
  | { status: 'loading' }
  | { status: 'error'; error: string; retry: () => void }
  | { status: 'ready'; data: WalletData };

export interface SeedWalletConnection {
  type: 'seed';
  walletFacade: WalletFacade;
  shieldedSecretKeys: ZswapSecretKeys;
  dustSecretKey: DustSecretKey;
}

export interface ExtensionWalletConnection {
  type: 'extension';
  connectedAPI: ConnectedAPI;
}

export type WalletConnection = SeedWalletConnection | ExtensionWalletConnection;
