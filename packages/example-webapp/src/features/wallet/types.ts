/**
 * Common wallet capabilities interface.
 */
export interface WalletCapabilities {
  getDustAddress(): Promise<{ dustAddress: string }>;
  getDustBalance(): Promise<{ balance: bigint; cap: bigint }>;
  getShieldedAddresses(): Promise<{
    shieldedAddress: string;
    shieldedCoinPublicKey: string;
    shieldedEncryptionPublicKey: string;
  }>;
  getUnshieldedAddress(): Promise<{ unshieldedAddress: string }>;
  getUnshieldedBalances(): Promise<Record<string, bigint>>;
  getShieldedBalances(): Promise<Record<string, bigint>>;
}

export interface WalletData {
  unshieldedAddress: string;
  shieldedAddress: string;
  dustAddress: string;
  dustBalance: bigint;
  dustCap: bigint;
  nightBalances: Record<string, bigint>;
  shieldedBalances: Record<string, bigint>;
}

export type WalletInfoState =
  | { status: 'loading' }
  | { status: 'error'; error: string; retry: () => void }
  | { status: 'ready'; data: WalletData; refresh: () => void };
