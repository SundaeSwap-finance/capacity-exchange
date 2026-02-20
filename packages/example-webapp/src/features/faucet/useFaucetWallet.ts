import { useState, useEffect, useRef } from 'react';
import type { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import type { MidnightProvider, WalletProvider } from '@midnight-ntwrk/midnight-js-types';
import { DustWalletProvider, type WalletKeys } from '@capacity-exchange/core';
import type { NetworkConfig } from '../../config';
import type { WalletCapabilities } from '../wallet/types';
import { connectSeedWallet } from '../wallet/seed/walletService';
import { SeedWalletAdapter } from '../wallet/seed/SeedWalletAdapter';

export type FaucetWalletStatus = 'idle' | 'syncing' | 'ready' | 'error';

export interface FaucetWallet {
  status: FaucetWalletStatus;
  error: string | null;
  walletFacade: WalletFacade | null;
  keys: WalletKeys | null;
  walletCapabilities: WalletCapabilities | null;
  walletProvider: WalletProvider | null;
  midnightProvider: MidnightProvider | null;
}

interface FaucetWalletReady {
  walletFacade: WalletFacade;
  keys: WalletKeys;
  walletCapabilities: WalletCapabilities;
  walletProvider: WalletProvider;
  midnightProvider: MidnightProvider;
}

const FAUCET_SEED_HEX = import.meta.env.VITE_FAUCET_SEED_HEX as string;

async function initFaucetWallet(config: NetworkConfig): Promise<FaucetWalletReady> {
  const connection = await connectSeedWallet(FAUCET_SEED_HEX, config);
  const { walletFacade, keys } = connection;

  const walletCapabilities = new SeedWalletAdapter(walletFacade, connection.networkId);
  const walletProvider = new DustWalletProvider(walletFacade, keys.shieldedSecretKeys, keys.dustSecretKey);
  const midnightProvider: MidnightProvider = {
    async submitTx(tx) {
      await walletFacade.submitTransaction(tx);
      return tx.identifiers()[0];
    },
  };

  return { walletFacade, keys, walletCapabilities, walletProvider, midnightProvider };
}

export function useFaucetWallet(config: NetworkConfig | null): FaucetWallet {
  const [status, setStatus] = useState<FaucetWalletStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState<FaucetWalletReady | null>(null);
  const initRef = useRef(false);

  useEffect(() => {
    if (!config || initRef.current) {
      return;
    }
    initRef.current = true;

    setStatus('syncing');
    setError(null);

    initFaucetWallet(config)
      .then((result) => {
        setReady(result);
        setStatus('ready');
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to initialize faucet wallet');
        setStatus('error');
      });
  }, [config]);

  return {
    status,
    error,
    walletFacade: ready?.walletFacade ?? null,
    keys: ready?.keys ?? null,
    walletCapabilities: ready?.walletCapabilities ?? null,
    walletProvider: ready?.walletProvider ?? null,
    midnightProvider: ready?.midnightProvider ?? null,
  };
}
