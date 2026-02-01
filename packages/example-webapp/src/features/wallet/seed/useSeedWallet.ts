import { useState, useCallback } from 'react';
import type { WalletCapabilities } from '../types';
import type { SeedWalletStatus, SeedWalletState, SeedWalletInternals } from './types';
import { connectSeedWallet } from './walletService';
import { SeedWalletAdapter } from './SeedWalletAdapter';
import { config } from '../../../config';

/**
 * Hook that manages the lifecycle of a seed-based wallet connection.
 */
export function useSeedWallet(): SeedWalletState {
  const [status, setStatus] = useState<SeedWalletStatus>('disconnected');
  const [wallet, setWallet] = useState<WalletCapabilities | null>(null);
  const [internals, setInternals] = useState<SeedWalletInternals | null>(null);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async (seed: string) => {
    if (status === 'connecting' || status === 'connected') {
      return;
    }

    setStatus('connecting');
    setError(null);

    try {
      const connection = await connectSeedWallet(seed, config);
      const adapter = new SeedWalletAdapter(connection.walletFacade, connection.keys, connection.networkId);
      setWallet(adapter);
      setInternals({
        walletFacade: connection.walletFacade,
        keys: connection.keys,
        networkId: connection.networkId,
      });
      setStatus('connected');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect wallet');
      setStatus('disconnected');
    }
  }, [status]);

  const disconnect = useCallback(() => {
    setWallet(null);
    setInternals(null);
    setStatus('disconnected');
    setError(null);
  }, []);

  return {
    status,
    wallet,
    internals,
    error,
    connect,
    disconnect,
  };
}
