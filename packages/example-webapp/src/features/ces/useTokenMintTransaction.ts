import { useState, useCallback } from 'react';
import { findDeployedContract, submitCallTx } from '@midnight-ntwrk/midnight-js-contracts';
import type { BrowserProviders } from './createBrowserProviders';
import { buildContractProviders } from './contractProviders';

import * as TokenMint from '../../../contracts/token-mint/out/contract/index.js';

type TokenMintCircuitId =
  | 'mint_test_tokens'
  | 'own_balance'
  | 'total_held'
  | 'get_token_color'
  | 'first_deposit'
  | 'deposit'
  | 'withdraw';

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
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
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

  const mintTokens = useCallback(
    async (amount: bigint) => {
      if (!providers || !contractAddress) {
        setError('Providers or contract address not available');
        return;
      }

      setStatus('building');
      setError(null);

      try {
        const { contractProviders } = buildContractProviders<TokenMintCircuitId>(
          providers,
          providers.walletProvider,
          '/midnight/token-mint'
        );

        const contract = createTokenMintContract();
        const privateStateId = generatePrivateStateId();
        const initialPrivateState = createPrivateState();

        await findDeployedContract(contractProviders, {
          contract,
          contractAddress,
          privateStateId,
          initialPrivateState,
        });

        setStatus('submitting');

        await submitCallTx(contractProviders, {
          contract,
          contractAddress,
          circuitId: 'mint_test_tokens',
          args: [amount],
          privateStateId,
        });

        setStatus('success');
      } catch (err) {
        console.error('[TokenMintTransaction] Error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setStatus('error');
      }
    },
    [providers, contractAddress]
  );

  return {
    status,
    error,
    mintTokens,
  };
}
