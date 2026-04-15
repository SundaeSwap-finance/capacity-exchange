import { useMemo, useState, useEffect } from 'react';
import type { WalletProvider, MidnightProvider } from '@midnight-ntwrk/midnight-js-types';
import {
  type CoinPublicKey,
  type EncPublicKey,
  SignatureEnabled,
  type Proof,
  type PreBinding,
  Transaction,
} from '@midnight-ntwrk/ledger-v8';
import type { BalanceTransaction } from '@sundaeswap/capacity-exchange-providers';
import type { SeedWalletConnection, ExtensionWalletConnection, WalletConnection } from '../wallet/types';
import { useWalletInfo } from '../wallet/useWalletInfo';
import type { WalletCapabilities, WalletInfoState } from '../wallet/types';
import {
  connectedApiProvidersAdapter,
  createConnectedAPI,
  type WalletIdentity,
  uint8ArrayToHex,
} from '@sundaeswap/capacity-exchange-core';
import { useNetworkConfig } from '../../config';

const DEFAULT_BALANCE_TTL_MS = 5 * 60 * 1000;

export interface WalletProviders {
  walletProvider: WalletProvider;
  midnightProvider: MidnightProvider;
  balanceTransaction: BalanceTransaction;
}

function buildSeedWalletProviders(
  walletConnection: SeedWalletConnection,
  config: ReturnType<typeof useNetworkConfig>
): WalletProviders {
  const { walletFacade, keys } = walletConnection;
  const connectedAPI = createConnectedAPI({ walletFacade, keys }, config.networkId, config.proofServerUrl);
  const identity: WalletIdentity = {
    coinPublicKey: keys.shieldedSecretKeys.coinPublicKey,
    encryptionPublicKey: keys.shieldedSecretKeys.encryptionPublicKey,
  };
  const { walletProvider, midnightProvider } = connectedApiProvidersAdapter(connectedAPI, identity);

  const balanceTransaction: BalanceTransaction = async (txHex) => {
    const tx = Transaction.deserialize<SignatureEnabled, Proof, PreBinding>(
      'signature',
      'proof',
      'pre-binding',
      Buffer.from(txHex, 'hex')
    );
    const ttl = new Date(Date.now() + DEFAULT_BALANCE_TTL_MS);
    const recipe = await walletFacade.balanceUnboundTransaction(
      tx,
      { shieldedSecretKeys: keys.shieldedSecretKeys, dustSecretKey: keys.dustSecretKey },
      { ttl, tokenKindsToBalance: ['shielded'] }
    );
    const balancedTx = await walletFacade.finalizeRecipe(recipe);
    return {
      tx: uint8ArrayToHex(balancedTx.serialize()),
    };
  };

  return { walletProvider, midnightProvider, balanceTransaction };
}

function buildExtensionWalletProviders(
  walletConnection: ExtensionWalletConnection,
  identity: WalletIdentity
): WalletProviders {
  const { connectedAPI } = walletConnection;
  const { walletProvider, midnightProvider } = connectedApiProvidersAdapter(connectedAPI, identity);

  const balanceTransaction = connectedAPI.balanceSealedTransaction.bind(connectedAPI);

  return { walletProvider, midnightProvider, balanceTransaction };
}

export function useWalletProviders(
  wallet: WalletCapabilities | null,
  walletConnection: WalletConnection | null
): { providers: WalletProviders | null; walletInfo: WalletInfoState } {
  const config = useNetworkConfig();
  const walletInfo = useWalletInfo(wallet);
  const [extensionIdentity, setExtensionIdentity] = useState<WalletIdentity | null>(null);

  useEffect(() => {
    if (walletConnection?.type !== 'extension' || !wallet) {
      setExtensionIdentity(null);
      return;
    }
    let cancelled = false;
    wallet
      .getShieldedAddresses()
      .then((addr) => {
        if (!cancelled) {
          setExtensionIdentity({
            coinPublicKey: addr.shieldedCoinPublicKey as CoinPublicKey,
            encryptionPublicKey: addr.shieldedEncryptionPublicKey as EncPublicKey,
          });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Failed to fetch shielded addresses from extension:', err);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [walletConnection, wallet]);

  const providers = useMemo<WalletProviders | null>(() => {
    if (!walletConnection || walletInfo.status !== 'ready') {
      return null;
    }

    if (walletConnection.type === 'seed') {
      return buildSeedWalletProviders(walletConnection, config);
    }

    if (walletConnection.type === 'extension') {
      if (!extensionIdentity) {
        return null;
      }
      return buildExtensionWalletProviders(walletConnection, extensionIdentity);
    }

    return null;
  }, [walletInfo, walletConnection, extensionIdentity, config]);

  return { providers, walletInfo };
}
