import { useState, useEffect, useRef } from 'react';
import type { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import type { MidnightProvider, WalletProvider } from '@midnight-ntwrk/midnight-js-types';
import { DustWalletProvider, resolveWalletSeed, uint8ArrayToHex, type WalletKeys } from '@capacity-exchange/midnight-core';
import type { NetworkConfig } from '../../config';
import type { WalletCapabilities } from '../wallet/types';
import { connectSeedWallet } from '../wallet/seed/walletService';
import { SeedWalletAdapter } from '../wallet/seed/SeedWalletAdapter';

export type ServerWalletStatus = 'idle' | 'syncing' | 'ready' | 'error';

export interface ServerWallet {
  status: ServerWalletStatus;
  error: string | null;
  walletFacade: WalletFacade | null;
  keys: WalletKeys | null;
  walletCapabilities: WalletCapabilities | null;
  walletProvider: WalletProvider | null;
  midnightProvider: MidnightProvider | null;
}

interface ServerWalletReady {
  walletFacade: WalletFacade;
  keys: WalletKeys;
  walletCapabilities: WalletCapabilities;
  walletProvider: WalletProvider;
  midnightProvider: MidnightProvider;
}

async function initServerWallet(config: NetworkConfig): Promise<ServerWalletReady> {
  const prefix = `VITE_SERVER_${config.networkId.toUpperCase()}`;
  const seed = resolveWalletSeed(import.meta.env as Record<string, string | undefined>, prefix);
  const seedHex = uint8ArrayToHex(seed);
  const connection = await connectSeedWallet(seedHex, config);
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

export function useServerWallet(config: NetworkConfig | null): ServerWallet {
  const [status, setStatus] = useState<ServerWalletStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState<ServerWalletReady | null>(null);
  const initRef = useRef(false);

  useEffect(() => {
    if (!config || initRef.current) {
      return;
    }
    initRef.current = true;

    setStatus('syncing');
    setError(null);

    initServerWallet(config)
      .then((result) => {
        setReady(result);
        setStatus('ready');
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to initialize server wallet');
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
