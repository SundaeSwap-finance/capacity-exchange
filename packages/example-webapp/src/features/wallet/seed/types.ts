import type { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import type { WalletCapabilities } from '../types';
import type { WalletKeys } from './walletService';
import type { SyncProgressInfo } from './walletService';

/**
 * States for seed wallet connection.
 *
 * - `disconnected`: No wallet connected
 * - `connecting`: Deriving keys and syncing wallet
 * - `connected`: Successfully connected to the wallet
 */
export type SeedWalletStatus = 'disconnected' | 'connecting' | 'connected';

export interface SeedWalletInternals {
  walletFacade: WalletFacade;
  keys: WalletKeys;
  networkId: string;
}

export interface SeedWalletState {
  status: SeedWalletStatus;
  wallet: WalletCapabilities | null;
  internals: SeedWalletInternals | null;
  error: string | null;
  syncProgress: SyncProgressInfo | null;
  connect: (seed: string) => Promise<void>;
  disconnect: () => void;
}

export interface SeedValidation {
  isValid: boolean;
  error?: string;
}
