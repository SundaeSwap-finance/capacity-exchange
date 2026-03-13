import { useMemo, useState, useEffect } from 'react';
import type { SeedWalletConnection, ExtensionWalletConnection, WalletConnection } from '../wallet/types';
import { useWalletInfo } from '../wallet/useWalletInfo';
import type { WalletCapabilities, WalletInfoState } from '../wallet/types';
import {
  connectedApiProvidersAdapter,
  type ConnectedApiProviders,
  type ShieldedAddressInfo,
} from '@capacity-exchange/midnight-core';
import { createSeedWalletConnectedAPIAdapter } from '../ces/seedWalletConnectedApi';
import { useNetworkConfig } from '../../config';

function buildSeedProviders(
  walletConnection: SeedWalletConnection,
  walletData: WalletInfoState & { status: 'ready' },
  config: ReturnType<typeof useNetworkConfig>
): ConnectedApiProviders {
  const shieldedAddress: ShieldedAddressInfo = {
    shieldedAddress: walletData.data.shieldedAddress,
    shieldedCoinPublicKey: walletConnection.shieldedSecretKeys.coinPublicKey,
    shieldedEncryptionPublicKey: walletConnection.shieldedSecretKeys.encryptionPublicKey,
  };
  const connectedAPI = createSeedWalletConnectedAPIAdapter(
    walletConnection.walletFacade,
    walletConnection.shieldedSecretKeys,
    walletConnection.dustSecretKey,
    shieldedAddress,
    walletData.data.unshieldedAddress,
    walletData.data.dustAddress,
    config
  );
  return connectedApiProvidersAdapter(connectedAPI, shieldedAddress);
}

// TODO: Make useConnectedApiProviders responsible for building the ConnectedAPI for both paths,
// so WalletConnection doesn't need to expose raw connectedAPI.
function buildExtensionProviders(
  walletConnection: ExtensionWalletConnection,
  shieldedAddressInfo: ShieldedAddressInfo
): ConnectedApiProviders {
  return connectedApiProvidersAdapter(walletConnection.connectedAPI, shieldedAddressInfo);
}

export function useConnectedApiProviders(
  wallet: WalletCapabilities | null,
  walletConnection: WalletConnection | null
): { providers: ConnectedApiProviders | null; walletInfo: WalletInfoState } {
  const config = useNetworkConfig();
  const walletInfo = useWalletInfo(wallet);
  // Fetched async from the browser extension; null until resolved.
  const [extensionAddressInfo, setExtensionAddressInfo] = useState<ShieldedAddressInfo | null>(null);

  useEffect(() => {
    if (walletConnection?.type !== 'extension' || !wallet) {
      setExtensionAddressInfo(null);
      return;
    }
    wallet
      .getShieldedAddresses()
      .then(setExtensionAddressInfo)
      .catch((err) => {
        console.error('Failed to fetch shielded addresses from extension:', err);
      });
  }, [walletConnection, wallet]);

  const providers = useMemo<ConnectedApiProviders | null>(() => {
    if (!walletConnection || walletInfo.status !== 'ready') {
      return null;
    }

    if (walletConnection.type === 'seed') {
      return buildSeedProviders(walletConnection, walletInfo, config);
    }

    if (walletConnection.type === 'extension') {
      if (!extensionAddressInfo) {
        return null;
      }
      return buildExtensionProviders(walletConnection, extensionAddressInfo);
    }

    return null;
  }, [walletInfo, walletConnection, extensionAddressInfo, config]);

  return { providers, walletInfo };
}
