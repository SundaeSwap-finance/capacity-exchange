import { useState, useCallback } from 'react';
import { findDeployedContract, submitCallTx } from '@midnight-ntwrk/midnight-js-contracts';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import type { BrowserProviders } from './createBrowserProviders';
import { config } from '../../config';

import * as TokenMint from '../../../contracts/token-mint/out/contract/index.js';

type TokenMintCircuitId = 'mint_test_tokens' | 'own_balance' | 'total_held' | 'get_token_color' | 'first_deposit' | 'deposit' | 'withdraw';

interface CircuitPrivateState {
  secret_key: Uint8Array;
}

type TokenMintContract = TokenMint.Contract<CircuitPrivateState, TokenMint.Witnesses<CircuitPrivateState>>;

function createTokenMintContract(): TokenMintContract {
  const witnesses: TokenMint.Witnesses<CircuitPrivateState> = {
    local_secret_key: ({ privateState }) => [privateState, privateState.secret_key],
  };
  return new TokenMint.Contract(witnesses);
}

function createPrivateState(): CircuitPrivateState {
  const secretKey = new Uint8Array(32);
  crypto.getRandomValues(secretKey);
  return { secret_key: secretKey };
}

function generatePrivateStateId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

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
  const [status, setStatus] = useState<TokenMintStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const mintTokens = useCallback(async (amount: bigint) => {
    if (!providers || !contractAddress) {
      setError('Providers or contract address not available');
      return;
    }

    setStatus('building');
    setError(null);

    try {
      const zkConfigHttpBase = window.location.origin + '/midnight/token-mint';
      const zkConfigProvider = new FetchZkConfigProvider<TokenMintCircuitId>(
        zkConfigHttpBase,
        fetch.bind(window)
      );

      const publicDataProvider = indexerPublicDataProvider(
        config.indexerUrl,
        config.indexerWsUrl
      );

      // Use the normal wallet provider (pays fees with user's DUST)
      const privateStateProvider = levelPrivateStateProvider({
        walletProvider: providers.walletProvider,
      });

      const contractProviders = {
        midnightProvider: providers.midnightProvider,
        privateStateProvider,
        proofProvider: providers.proofProvider,
        publicDataProvider,
        walletProvider: providers.walletProvider,
        zkConfigProvider,
      };

      const contract = createTokenMintContract();
      const privateStateId = generatePrivateStateId();
      const initialPrivateState = createPrivateState();

      console.debug('[TokenMintTransaction] Contract address:', contractAddress);
      console.debug('[TokenMintTransaction] Private state ID:', privateStateId);
      console.debug('[TokenMintTransaction] Using normal wallet provider (DUST fees)');
      console.debug('[TokenMintTransaction] Finding deployed contract...');

      try {
        await findDeployedContract(contractProviders, {
          contract,
          contractAddress,
          privateStateId,
          initialPrivateState,
        });
        console.debug('[TokenMintTransaction] Found deployed contract successfully');
      } catch (findErr) {
        console.error('[TokenMintTransaction] findDeployedContract failed:', findErr);
        console.error('[TokenMintTransaction] Full error stack:', findErr instanceof Error ? findErr.stack : 'No stack');
        throw findErr;
      }

      console.debug('[TokenMintTransaction] Submitting mint_test_tokens call...');
      setStatus('submitting');

      try {
        const result = await submitCallTx(contractProviders, {
          contract,
          contractAddress,
          circuitId: 'mint_test_tokens',
          args: [amount],
          privateStateId,
        });
        console.debug('[TokenMintTransaction] Mint succeeded:', result);
        setStatus('success');
      } catch (submitErr) {
        console.error('[TokenMintTransaction] submitCallTx failed:', submitErr);
        console.error('[TokenMintTransaction] Full error stack:', submitErr instanceof Error ? submitErr.stack : 'No stack');
        throw submitErr;
      }
    } catch (err) {
      console.error('[TokenMintTransaction] Error:', err);
      console.error('[TokenMintTransaction] Error type:', err?.constructor?.name);
      if (err instanceof Error) {
        console.error('[TokenMintTransaction] Full stack trace:', err.stack);
      }

      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
    }
  }, [providers, contractAddress]);

  return {
    status,
    error,
    mintTokens,
  };
}
