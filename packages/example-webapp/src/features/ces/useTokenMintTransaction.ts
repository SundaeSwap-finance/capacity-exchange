// TODO: Wire this into the UI once we migrate off the SSE/CLI backend.
// This hook replaces useTokenMintOperations + the server/scriptRunner flow
// by calling the contract directly from the browser.
import { useState, useCallback } from 'react';
import type { BrowserProviders } from './createBrowserProviders';
import { findAndMintTokens } from './tokenMintContract';
import { useNetworkConfig } from '../../config';

export type TokenMintStatus = 'idle' | 'building' | 'submitting' | 'success' | 'error';

export interface UseTokenMintTransactionResult {
  status: TokenMintStatus;
  error: string | null;
  mintTokens: (amount: bigint) => Promise<void>;
}

export function useTokenMintTransaction(
  providers: BrowserProviders | null,
  contractAddress: string | null
): UseTokenMintTransactionResult {
  const config = useNetworkConfig();
  const [status, setStatus] = useState<TokenMintStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const mintTokens = useCallback(
    async (amount: bigint) => {
      if (!providers || !contractAddress) {
        setError('Providers or contract address not available');
        return;
      }

      setStatus('building');
      setError(null);

      try {
        await findAndMintTokens(providers, contractAddress, amount, config);
        setStatus('success');
      } catch (err) {
        console.error('[TokenMintTransaction] Error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setStatus('error');
      }
    },
    [providers, contractAddress, config]
  );

  return {
    status,
    error,
    mintTokens,
  };
}
