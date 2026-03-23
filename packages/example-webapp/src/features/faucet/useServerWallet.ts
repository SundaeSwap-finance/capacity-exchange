import { useState, useEffect, useRef } from 'react';
import type { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import type { MidnightProvider, WalletProvider } from '@midnight-ntwrk/midnight-js-types';
import {
  DustWalletProvider,
  parseMnemonic,
  parseSeedHex,
  uint8ArrayToHex,
  type WalletKeys,
} from '@capacity-exchange/midnight-core';
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

function resolveServerSeedHex(networkId: string): string {
  const networkKey = networkId.toUpperCase();
  const seedEnv = import.meta.env[`VITE_SERVER_${networkKey}_SEED`];
  if (seedEnv) {
    parseSeedHex(seedEnv);
    return seedEnv.trim();
  }
  const mnemonicEnv = import.meta.env[`VITE_SERVER_${networkKey}_MNEMONIC`];
  if (mnemonicEnv) {
    return uint8ArrayToHex(parseMnemonic(mnemonicEnv));
  }
  throw new Error(`No server wallet configured. Set VITE_SERVER_${networkKey}_SEED or VITE_SERVER_${networkKey}_MNEMONIC`);
}

async function initServerWallet(config: NetworkConfig): Promise<ServerWalletReady> {
  const seedHex = resolveServerSeedHex(config.networkId);
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
