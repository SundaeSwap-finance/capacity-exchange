import { useMemo, useState, useEffect } from 'react';
import type { WalletConnection, WalletInfoState } from '../wallet/types';
import { useWalletInfo } from '../wallet/useWalletInfo';
import type { WalletCapabilities } from '../wallet/types';
import {
  createProvidersFromSeedWallet,
  createProvidersFromExtensionWallet,
  type BrowserProviders,
  type ShieldedAddressInfo,
} from '../ces/createBrowserProviders';
import { config } from '../../config';

export function useBrowserProviders(
  wallet: WalletCapabilities,
  walletConnection: WalletConnection
): { providers: BrowserProviders | null; walletInfo: WalletInfoState } {
  const walletInfo = useWalletInfo(wallet);
  const [shieldedAddressInfo, setShieldedAddressInfo] = useState<ShieldedAddressInfo | null>(null);

  useEffect(() => {
    if (walletConnection.type === 'extension') {
      walletConnection.connectedAPI.getShieldedAddresses().then(setShieldedAddressInfo);
    }
  }, [walletConnection]);

  const providers = useMemo<BrowserProviders | null>(() => {
    if (walletInfo.status !== 'ready') {
      return null;
    }

    if (walletConnection.type === 'seed') {
      const shieldedAddress = {
        shieldedAddress: walletInfo.data.shieldedAddress,
        shieldedCoinPublicKey: walletConnection.shieldedSecretKeys.coinPublicKey,
        shieldedEncryptionPublicKey: walletConnection.shieldedSecretKeys.encryptionPublicKey,
      };
      return createProvidersFromSeedWallet(
        {
          walletFacade: walletConnection.walletFacade,
          shieldedSecretKeys: walletConnection.shieldedSecretKeys,
          dustSecretKey: walletConnection.dustSecretKey,
          shieldedAddress,
          unshieldedAddress: walletInfo.data.unshieldedAddress,
          dustAddress: walletInfo.data.dustAddress,
        },
        config
      );
    } else if (walletConnection.type === 'extension') {
      if (!shieldedAddressInfo) {
        return null;
      }
      return createProvidersFromExtensionWallet(walletConnection.connectedAPI, shieldedAddressInfo, config);
    }

    return null;
  }, [walletInfo, walletConnection, shieldedAddressInfo]);

  return { providers, walletInfo };
}
