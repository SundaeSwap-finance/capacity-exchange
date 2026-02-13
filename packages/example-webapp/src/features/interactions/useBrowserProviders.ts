import { useMemo, useState, useEffect } from 'react';
import type { SeedWalletConnection, ExtensionWalletConnection, WalletConnection } from '../wallet/types';
import { useWalletInfo } from '../wallet/useWalletInfo';
import type { WalletCapabilities, WalletInfoState } from '../wallet/types';
import {
  createProvidersFromSeedWallet,
  createProvidersFromExtensionWallet,
  type BrowserProviders,
  type ShieldedAddressInfo,
} from '../ces/createBrowserProviders';
import { config } from '../../config';

function buildSeedProviders(
  walletConnection: SeedWalletConnection,
  walletData: WalletInfoState & { status: 'ready' }
): BrowserProviders {
  const shieldedAddress: ShieldedAddressInfo = {
    shieldedAddress: walletData.data.shieldedAddress,
    shieldedCoinPublicKey: walletConnection.shieldedSecretKeys.coinPublicKey,
    shieldedEncryptionPublicKey: walletConnection.shieldedSecretKeys.encryptionPublicKey,
  };
  return createProvidersFromSeedWallet(
    {
      walletFacade: walletConnection.walletFacade,
      shieldedSecretKeys: walletConnection.shieldedSecretKeys,
      dustSecretKey: walletConnection.dustSecretKey,
      shieldedAddress,
      unshieldedAddress: walletData.data.unshieldedAddress,
      dustAddress: walletData.data.dustAddress,
    },
    config
  );
}

function buildExtensionProviders(
  walletConnection: ExtensionWalletConnection,
  shieldedAddressInfo: ShieldedAddressInfo
): BrowserProviders {
  return createProvidersFromExtensionWallet(walletConnection.connectedAPI, shieldedAddressInfo, config);
}

export function useBrowserProviders(
  wallet: WalletCapabilities | null,
  walletConnection: WalletConnection | null
): { providers: BrowserProviders | null; walletInfo: WalletInfoState } {
  const walletInfo = useWalletInfo(wallet);
  const [extensionAddressInfo, setExtensionAddressInfo] = useState<ShieldedAddressInfo | null>(null);

  useEffect(() => {
    if (walletConnection?.type !== 'extension') {
      setExtensionAddressInfo(null);
      return;
    }
    walletConnection.connectedAPI.getShieldedAddresses().then(setExtensionAddressInfo);
  }, [walletConnection]);

  const providers = useMemo<BrowserProviders | null>(() => {
    if (!walletConnection || walletInfo.status !== 'ready') {
      return null;
    }

    if (walletConnection.type === 'seed') {
      return buildSeedProviders(walletConnection, walletInfo);
    }

    if (!extensionAddressInfo) {
      return null;
    }
    return buildExtensionProviders(walletConnection, extensionAddressInfo);
  }, [walletInfo, walletConnection, extensionAddressInfo]);

  return { providers, walletInfo };
}
