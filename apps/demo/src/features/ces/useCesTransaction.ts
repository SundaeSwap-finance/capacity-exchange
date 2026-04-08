import { type RefObject, useState, useRef, useCallback } from 'react';
import {
  type CurrencySelectionResult,
  type PromptForCurrency,
  type ConfirmOffer,
  CapacityExchangeUserCancelledError,
  CapacityExchangeNoPricesAvailableError,
} from '@sundaeswap/capacity-exchange-providers';
import type { WalletProvider, MidnightProvider } from '@midnight-ntwrk/midnight-js-types';
import type { BalanceSealedTransaction } from '@sundaeswap/capacity-exchange-providers';
import type { CesFlowStatus, CurrencySelectionState } from './types';
import { findAndIncrementCounter } from './counterContract';
import { useNetworkConfig } from '../../config';
import { withDustRetry } from '../../utils/retry';

function toUserErrorMessage(err: unknown): string {
  if (err instanceof CapacityExchangeUserCancelledError) {
    return 'Transaction cancelled';
  }
  if (err instanceof CapacityExchangeNoPricesAvailableError) {
    return 'No capacity exchange prices available';
  }
  return err instanceof Error ? err.message : 'Unknown error';
}

export interface UseCesTransactionResult {
  status: CesFlowStatus;
  error: string | null;

  currencySelection: CurrencySelectionState | null;
  onCurrencySelected: (result: CurrencySelectionResult) => void;

  dismissOffer: () => void;

  incrementCounter: () => Promise<void>;
}

interface PromiseResolvers<T> {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
}

// Pauses the SDK flow with an unresolved promise, shows the currency selection
// modal, and resumes when onCurrencySelected resolves the promise.
function createPromptForCurrency(
  setStatus: (status: CesFlowStatus) => void,
  setCurrencySelection: (state: CurrencySelectionState | null) => void,
  resolverRef: RefObject<PromiseResolvers<CurrencySelectionResult> | null>
): PromptForCurrency {
  return async (prices, specksRequired) => {
    setStatus('selecting-currency');
    setCurrencySelection({ prices, specksRequired });
    return new Promise((resolve, reject) => {
      resolverRef.current = { resolve, reject };
    });
  };
}

// Auto-confirms the offer once the user has already selected a currency.
// The currency selection is the user's confirmation — no need to ask twice.
function createAutoConfirmOffer(
  setStatus: (status: CesFlowStatus) => void,
  setCurrencySelection: (state: CurrencySelectionState | null) => void
): ConfirmOffer {
  return async (_offer, _specksRequired) => {
    setCurrencySelection(null);
    setStatus('submitting');
    return { status: 'confirmed' as const };
  };
}

// Connects capacityExchangeWalletProvider's async callbacks with React state.
// The SDK pauses for user input via promises; this hook stores resolvers in refs
// and resumes the flow when modals call onCurrencySelected.
//
// Flow: idle -> building -> selecting-currency -> fetching-offers -> submitting -> success/error
export function useCesTransaction(
  walletProvider: WalletProvider | null,
  midnightProvider: MidnightProvider | null,
  balanceSealedTransaction: BalanceSealedTransaction | null,
  contractAddress: string | null
): UseCesTransactionResult {
  const config = useNetworkConfig();
  const [status, setStatus] = useState<CesFlowStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [currencySelection, setCurrencySelection] = useState<CurrencySelectionState | null>(null);

  // Promise resolvers that connect SDK callbacks to UI interactions.
  const currencyResolverRef = useRef<PromiseResolvers<CurrencySelectionResult> | null>(null);

  // Resolves the pending currency promise to resume the SDK flow.
  const onCurrencySelected = useCallback((result: CurrencySelectionResult) => {
    if (currencyResolverRef.current) {
      currencyResolverRef.current.resolve(result);
      currencyResolverRef.current = null;
    }
    if (result.status === 'selected') {
      setStatus('fetching-offers');
    } else {
      setCurrencySelection(null);
    }
  }, []);

  // Resets to idle.
  const dismissOffer = useCallback(() => {
    setStatus('idle');
    setError(null);
  }, []);

  const incrementCounter = useCallback(async () => {
    if (!walletProvider || !midnightProvider || !balanceSealedTransaction || !contractAddress) {
      setError('Providers or contract address not available');
      return;
    }

    setStatus('building');
    setError(null);

    const promptForCurrency = createPromptForCurrency(setStatus, setCurrencySelection, currencyResolverRef);
    const confirmOffer = createAutoConfirmOffer(setStatus, setCurrencySelection);

    try {
      await withDustRetry(
        () =>
          findAndIncrementCounter(
            walletProvider,
            midnightProvider,
            balanceSealedTransaction,
            contractAddress,
            promptForCurrency,
            confirmOffer,
            config
          ),
        { onRetry: (attempt) => console.warn(`[CESTransaction] Dust proof error, retrying (${attempt}/3)`) }
      );
      setStatus('success');
    } catch (err) {
      setCurrencySelection(null);
      if (
        err instanceof CapacityExchangeUserCancelledError ||
        (err instanceof Error && err.cause instanceof CapacityExchangeUserCancelledError)
      ) {
        setStatus('idle');
      } else {
        console.error('[CESTransaction] Error:', err);
        setError(toUserErrorMessage(err));
        setStatus('error');
      }
    }
  }, [walletProvider, midnightProvider, balanceSealedTransaction, contractAddress, config]);

  return {
    status,
    error,
    currencySelection,
    onCurrencySelected,
    dismissOffer,
    incrementCounter,
  };
}
