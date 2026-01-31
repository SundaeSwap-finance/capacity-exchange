import { useState, useCallback, useEffect } from 'react';
import type { WalletCapabilities } from '../types';
import type { SeedWalletStatus, SeedWalletState } from './types';
import { connectSeedWallet } from './walletService';
import { SeedWalletAdapter } from './SeedWalletAdapter';
import type { Config } from '../../../config';

/**
 * Hook that manages the lifecycle of a seed-based wallet connection.
 */
export function useSeedWallet(config: Config): SeedWalletState {
  const [status, setStatus] = useState<SeedWalletStatus>('disconnected');
  const [wallet, setWallet] = useState<WalletCapabilities | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset connection when config changes
  useEffect(() => {
    setWallet(null);
    setError(null);
    setStatus('disconnected');
  }, [config]);

  const connect = useCallback(
    async (seed: string) => {
      if (status === 'connecting' || status === 'connected') {
        return;
      }

      setStatus('connecting');
      setError(null);

      try {
        const connection = await connectSeedWallet(seed, config);
        const adapter = new SeedWalletAdapter(connection.walletFacade, connection.networkId);
        setWallet(adapter);
        setStatus('connected');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to connect wallet');
        setStatus('disconnected');
      }
    },
    [status, config]
  );

  const disconnect = useCallback(() => {
    setWallet(null);
    setStatus('disconnected');
    setError(null);
  }, []);

  return {
    status,
    wallet,
    error,
    connect,
    disconnect,
  };
}
