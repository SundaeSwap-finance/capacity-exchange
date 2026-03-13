import { useState, useCallback } from 'react';
import { sponsoredTransactionsWalletProvider } from '@capacity-exchange/components';
import type { ConnectedApiProviders } from '@capacity-exchange/midnight-core';
import { incrementCounter } from './counterContract';
import { useNetworkConfig } from '../../config';

export type SponsoredFlowStatus = 'idle' | 'building' | 'submitting' | 'success' | 'error';

export interface UseSponsoredTransactionResult {
  status: SponsoredFlowStatus;
  error: string | null;
  incrementCounter: () => Promise<void>;
  dismiss: () => void;
}

export function useSponsoredTransaction(
  providers: ConnectedApiProviders | null,
  contractAddress: string | null
): UseSponsoredTransactionResult {
  const config = useNetworkConfig();
  const [status, setStatus] = useState<SponsoredFlowStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const dismiss = useCallback(() => {
    setStatus('idle');
    setError(null);
  }, []);

  const handleIncrementCounter = useCallback(async () => {
    if (!providers || !contractAddress) {
      setError('Providers or contract address not available');
      return;
    }

    setStatus('building');
    setError(null);

    try {
      const walletProvider = sponsoredTransactionsWalletProvider({
        walletProvider: providers.walletProvider,
        capacityExchangeUrl: config.capacityExchangeUrl,
      });

      setStatus('submitting');
      await incrementCounter(providers, contractAddress, walletProvider, config);
      setStatus('success');
    } catch (err) {
      console.error('[SponsoredTransaction] Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
    }
  }, [providers, contractAddress, config]);

  return {
    status,
    error,
    incrementCounter: handleIncrementCounter,
    dismiss,
  };
}
