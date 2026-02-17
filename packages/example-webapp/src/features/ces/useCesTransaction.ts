import { type RefObject, useState, useRef, useCallback } from 'react';
import {
  type CurrencySelectionResult,
  type OfferConfirmationResult,
  type PromptForCurrency,
  type ConfirmOffer,
  CapacityExchangeUserCancelledError,
  CapacityExchangeNoPricesAvailableError,
} from '@capacity-exchange/components';
import type { BrowserProviders } from './createBrowserProviders';
import type { CesFlowStatus, CurrencySelectionState, OfferConfirmationState } from './types';
import { findAndIncrementCounter } from './counterContract';
import { useNetworkConfig } from '../../config';

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

  offerConfirmation: OfferConfirmationState | null;
  onOfferConfirmed: (result: OfferConfirmationResult) => void;
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

// Same pattern as above for the offer confirmation step.
function createConfirmOffer(
  setStatus: (status: CesFlowStatus) => void,
  setCurrencySelection: (state: CurrencySelectionState | null) => void,
  setOfferConfirmation: (state: OfferConfirmationState | null) => void,
  resolverRef: RefObject<PromiseResolvers<OfferConfirmationResult> | null>
): ConfirmOffer {
  return async (offer, specksRequired) => {
    setCurrencySelection(null);
    setStatus('confirming');
    setOfferConfirmation({ offer, specksRequired });
    return new Promise((resolve, reject) => {
      resolverRef.current = { resolve, reject };
    });
  };
}

// Connects capacityExchangeWalletProvider's async callbacks with React state.
// The SDK pauses for user input via promises; this hook stores resolvers in refs
// and resumes the flow when modals call onCurrencySelected/onOfferConfirmed.
//
// Flow: idle -> building -> selecting-currency -> fetching-offers -> confirming -> submitting -> success/error
export function useCesTransaction(
  providers: BrowserProviders | null,
  contractAddress: string | null
): UseCesTransactionResult {
  const config = useNetworkConfig();
  const [status, setStatus] = useState<CesFlowStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [currencySelection, setCurrencySelection] = useState<CurrencySelectionState | null>(null);
  const [offerConfirmation, setOfferConfirmation] = useState<OfferConfirmationState | null>(null);

  // Promise resolvers that connect SDK callbacks to UI interactions.
  const currencyResolverRef = useRef<PromiseResolvers<CurrencySelectionResult> | null>(null);
  const offerResolverRef = useRef<PromiseResolvers<OfferConfirmationResult> | null>(null);

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

  // Resolves the pending offer promise to resume the SDK flow.
  const onOfferConfirmed = useCallback((result: OfferConfirmationResult) => {
    if (offerResolverRef.current) {
      offerResolverRef.current.resolve(result);
      offerResolverRef.current = null;
    }
    if (result.status === 'confirmed') {
      setStatus('submitting');
    } else {
      setOfferConfirmation(null);
    }
  }, []);

  // Resets to idle.
  const dismissOffer = useCallback(() => {
    setOfferConfirmation(null);
    setStatus('idle');
    setError(null);
  }, []);

  const incrementCounter = useCallback(async () => {
    if (!providers || !contractAddress) {
      setError('Providers or contract address not available');
      return;
    }

    setStatus('building');
    setError(null);

    const promptForCurrency = createPromptForCurrency(setStatus, setCurrencySelection, currencyResolverRef);
    const confirmOffer = createConfirmOffer(setStatus, setCurrencySelection, setOfferConfirmation, offerResolverRef);

    try {
      await findAndIncrementCounter(providers, contractAddress, promptForCurrency, confirmOffer, config);
      setStatus('success');
    } catch (err) {
      setCurrencySelection(null);
      setOfferConfirmation(null);
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
  }, [providers, contractAddress, config]);

  return {
    status,
    error,
    currencySelection,
    onCurrencySelected,
    offerConfirmation,
    onOfferConfirmed,
    dismissOffer,
    incrementCounter,
  };
}
