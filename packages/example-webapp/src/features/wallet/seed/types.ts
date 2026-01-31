import type { WalletCapabilities } from '../types';

/**
 * States for seed wallet connection.
 *
 * - `disconnected`: No wallet connected
 * - `connecting`: Deriving keys and syncing wallet
 * - `connected`: Successfully connected to the wallet
 */
export type SeedWalletStatus = 'disconnected' | 'connecting' | 'connected';

export interface SeedWalletState {
  status: SeedWalletStatus;
  wallet: WalletCapabilities | null;
  error: string | null;
  connect: (seed: string) => Promise<void>;
  disconnect: () => void;
}

export interface SeedValidation {
  isValid: boolean;
  error?: string;
}
