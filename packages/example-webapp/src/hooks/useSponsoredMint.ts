import { useState, useCallback } from 'react';
import { sponsoredTransactionsWalletProvider } from '@capacity-exchange/components';
import type { WalletProviders } from '../features/interactions/useWalletProviders';
import { findAndMintTokens } from '../features/ces/tokenMintContract';
import { useNetworkConfig } from '../config';

export type SponsoredMintStatus = 'idle' | 'building' | 'submitting' | 'success' | 'error';

export interface UseSponsoredMintResult {
  status: SponsoredMintStatus;
  error: string | null;
  mint: (contractAddress: string, amount: bigint) => Promise<void>;
  reset: () => void;
}

export function useSponsoredMint(providers: WalletProviders | null): UseSponsoredMintResult {
  const config = useNetworkConfig();
  const [status, setStatus] = useState<SponsoredMintStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
  }, []);

  const mint = useCallback(
    async (contractAddress: string, amount: bigint) => {
      if (!providers) {
        setError('Wallet not connected');
        return;
      }

      setStatus('building');
      setError(null);

      try {
        const walletProvider = sponsoredTransactionsWalletProvider({
          walletProvider: providers.walletProvider,
          capacityExchangeUrl: config.capacityExchangeUrl,
        });

        await findAndMintTokens(providers.midnightProvider, walletProvider, contractAddress, amount, config);
        setStatus('success');
      } catch (err) {
        console.error('[SponsoredMint] Error:', err);
        setError(err instanceof Error ? err.message : 'Failed to mint tokens');
        setStatus('error');
      }
    },
    [providers, config]
  );

  return { status, error, mint, reset };
}
