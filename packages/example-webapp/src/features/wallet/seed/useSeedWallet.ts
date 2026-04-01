import { useState, useCallback, useEffect } from 'react';
import type { WalletCapabilities } from '../types';
import type { SeedWalletStatus, SeedWalletState, SeedWalletInternals } from './types';
import { connectSeedWallet, type SyncProgressInfo } from './walletService';
import { SeedWalletAdapter } from './SeedWalletAdapter';
import type { NetworkConfig } from '../../../config';

/**
 * Hook that manages the lifecycle of a seed-based wallet connection.
 */
export function useSeedWallet(config: NetworkConfig): SeedWalletState {
  const [status, setStatus] = useState<SeedWalletStatus>('disconnected');
  const [wallet, setWallet] = useState<WalletCapabilities | null>(null);
  const [internals, setInternals] = useState<SeedWalletInternals | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState<SyncProgressInfo | null>(null);

  // Reset connection when config changes
  useEffect(() => {
    setWallet(null);
    setInternals(null);
    setError(null);
    setSyncProgress(null);
    setStatus('disconnected');
  }, [config]);

  const connect = useCallback(
    async (seed: string, options?: { isNewWallet?: boolean }) => {
      if (status === 'connecting' || status === 'connected') {
        return;
      }

      console.debug('[useSeedWallet] connect called, isNewWallet=', options?.isNewWallet);
      setStatus('connecting');
      setError(null);
      setSyncProgress(null);

      try {
        console.log('[useSeedWallet] calling connectSeedWallet...');
        const connection = await connectSeedWallet(seed, config, (progress) => {
          setSyncProgress(progress);
        }, options?.isNewWallet);
        console.log('[useSeedWallet] connectSeedWallet returned');
        const adapter = new SeedWalletAdapter(connection.walletFacade, connection.networkId);
        console.log('[useSeedWallet] adapter created');
        setWallet(adapter);
        setInternals({
          walletFacade: connection.walletFacade,
          keys: connection.keys,
          networkId: connection.networkId,
        });
        setStatus('connected');
        console.log('[useSeedWallet] status set to connected');
      } catch (err) {
        console.error('[useSeedWallet] error:', err);
        setError(err instanceof Error ? err.message : 'Failed to connect wallet');
        setStatus('disconnected');
      }
    },
    [status, config]
  );

  const disconnect = useCallback(() => {
    setWallet(null);
    setInternals(null);
    setSyncProgress(null);
    setStatus('disconnected');
    setError(null);
  }, []);

  return {
    status,
    wallet,
    internals,
    error,
    syncProgress,
    connect,
    disconnect,
  };
}
