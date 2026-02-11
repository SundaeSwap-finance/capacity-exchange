import { useMemo } from 'react';
import type { WalletCapabilities } from './types';
import type { SeedWalletState } from './seed/types';
import type { ExtensionWalletState } from './extension/useExtensionWallet';
import type { WalletMode } from './WalletModeSelector';
import type { WalletConnection } from './types';

interface ActiveWallet {
  wallet: WalletCapabilities | null;
  walletConnection: WalletConnection | null;
}

export function useActiveWallet(
  walletMode: WalletMode | null,
  seedWallet: SeedWalletState,
  extensionWallet: ExtensionWalletState
): ActiveWallet {
  const none: ActiveWallet = { wallet: null, walletConnection: null };

  return useMemo(() => {
    if (walletMode === null) {
      return none;
    }

    if (walletMode === 'seed') {
      if (seedWallet.status !== 'connected') {
        return none;
      }
      return {
        wallet: seedWallet.wallet,
        walletConnection: seedWallet.internals
          ? {
              type: 'seed' as const,
              walletFacade: seedWallet.internals.walletFacade,
              shieldedSecretKeys: seedWallet.internals.keys.shieldedSecretKeys,
              dustSecretKey: seedWallet.internals.keys.dustSecretKey,
            }
          : null,
      };
    }

    if (extensionWallet.status !== 'connected') {
      return none;
    }
    return {
      wallet: extensionWallet.wallet,
      walletConnection: extensionWallet.connectedAPI
        ? {
            type: 'extension' as const,
            connectedAPI: extensionWallet.connectedAPI,
          }
        : null,
    };
  }, [walletMode, seedWallet, extensionWallet]);
}
