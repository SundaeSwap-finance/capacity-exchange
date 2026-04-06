import { useState, useCallback, useRef } from 'react';
import { sponsoredTransactionsWalletProvider } from '@capacity-exchange/providers';
import type { WalletProviders } from '../features/interactions/useWalletProviders';
import { findAndMintTokens } from '../features/ces/tokenMintContract';
import { useNetworkConfig } from '../config';
import { withDustRetry } from '../utils/retry';

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
  const inFlightRef = useRef(false);

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

      if (inFlightRef.current) {
        return;
      }
      inFlightRef.current = true;

      setStatus('building');
      setError(null);

      try {
        const walletProvider = sponsoredTransactionsWalletProvider({
          walletProvider: providers.walletProvider,
          capacityExchangeUrl: config.capacityExchangeUrl,
        });

        await withDustRetry(
          () => findAndMintTokens(providers.midnightProvider, walletProvider, contractAddress, amount, config),
          { onRetry: (attempt) => console.warn(`[SponsoredMint] Dust proof error, retrying (${attempt}/3)`) }
        );
        setStatus('success');
      } catch (err) {
        console.error('[SponsoredMint] Error:', err);
        setError(err instanceof Error ? err.message : 'Failed to mint tokens');
        setStatus('error');
      } finally {
        inFlightRef.current = false;
      }
    },
    [providers, config]
  );

  return { status, error, mint, reset };
}
