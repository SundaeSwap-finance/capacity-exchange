import { useMemo, useState, useEffect } from 'react';
import type { WalletProvider, MidnightProvider } from '@midnight-ntwrk/midnight-js-types';
import type { FinalizedTransaction, SignatureEnabled, Proof, Binding } from '@midnight-ntwrk/ledger-v7';
import { Transaction } from '@midnight-ntwrk/ledger-v7';
import type { BalanceSealedTx } from '@capacity-exchange/components';
import type { SeedWalletConnection, ExtensionWalletConnection, WalletConnection } from '../wallet/types';
import { useWalletInfo } from '../wallet/useWalletInfo';
import type { WalletCapabilities, WalletInfoState } from '../wallet/types';
import {
  connectedApiProvidersAdapter,
  type ShieldedAddressInfo,
  hexToBytes,
  uint8ArrayToHex,
} from '@capacity-exchange/midnight-core';
import { createSeedWalletConnectedAPIAdapter } from '../ces/seedWalletConnectedApi';
import { useNetworkConfig } from '../../config';

const DEFAULT_BALANCE_TTL_MS = 5 * 60 * 1000;

export interface WalletProviders {
  walletProvider: WalletProvider;
  midnightProvider: MidnightProvider;
  balanceSealedTx: BalanceSealedTx;
}

function buildSeedWalletProviders(
  walletConnection: SeedWalletConnection,
  walletData: WalletInfoState & { status: 'ready' },
  config: ReturnType<typeof useNetworkConfig>
): WalletProviders {
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
  const { walletProvider, midnightProvider } = connectedApiProvidersAdapter(connectedAPI, shieldedAddress);

  // Build balanceSealedTx directly from walletFacade — no hex roundtrip.
  const { walletFacade, shieldedSecretKeys, dustSecretKey } = walletConnection;
  const balanceSealedTx: BalanceSealedTx = async (tx) => {
    const ttl = new Date(Date.now() + DEFAULT_BALANCE_TTL_MS);
    const recipe = await walletFacade.balanceFinalizedTransaction(
      tx,
      { shieldedSecretKeys, dustSecretKey },
      { ttl, tokenKindsToBalance: ['shielded'] }
    );
    return walletFacade.finalizeRecipe(recipe);
  };

  return { walletProvider, midnightProvider, balanceSealedTx };
}

function buildExtensionWalletProviders(
  walletConnection: ExtensionWalletConnection,
  shieldedAddressInfo: ShieldedAddressInfo
): WalletProviders {
  const { connectedAPI } = walletConnection;
  const { walletProvider, midnightProvider } = connectedApiProvidersAdapter(connectedAPI, shieldedAddressInfo);

  const balanceSealedTx: BalanceSealedTx = async (tx) => {
    const serialized = uint8ArrayToHex(tx.serialize());
    const result = await connectedAPI.balanceSealedTransaction(serialized);
    return Transaction.deserialize<SignatureEnabled, Proof, Binding>(
      'signature',
      'proof',
      'binding',
      hexToBytes(result.tx)
    ).bind() as unknown as FinalizedTransaction;
  };

  return { walletProvider, midnightProvider, balanceSealedTx };
}

export function useWalletProviders(
  wallet: WalletCapabilities | null,
  walletConnection: WalletConnection | null
): { providers: WalletProviders | null; walletInfo: WalletInfoState } {
  const config = useNetworkConfig();
  const walletInfo = useWalletInfo(wallet);
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

  const providers = useMemo<WalletProviders | null>(() => {
    if (!walletConnection || walletInfo.status !== 'ready') {
      return null;
    }

    if (walletConnection.type === 'seed') {
      return buildSeedWalletProviders(walletConnection, walletInfo, config);
    }

    if (walletConnection.type === 'extension') {
      if (!extensionAddressInfo) {
        return null;
      }
      return buildExtensionWalletProviders(walletConnection, extensionAddressInfo);
    }

    return null;
  }, [walletInfo, walletConnection, extensionAddressInfo, config]);

  return { providers, walletInfo };
}
