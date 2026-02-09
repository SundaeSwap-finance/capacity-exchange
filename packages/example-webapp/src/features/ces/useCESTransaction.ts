import { useState, useRef, useCallback } from 'react';
import { findDeployedContract, submitCallTx } from '@midnight-ntwrk/midnight-js-contracts';
import {
  capacityExchangeWalletProvider,
  type CurrencySelectionResult,
  type OfferConfirmationResult,
  type PromptForCurrency,
  type ConfirmOffer,
  CapacityExchangeUserCancelledError,
  CapacityExchangeNoPricesAvailableError,
} from '@capacity-exchange/components';
import type { BrowserProviders } from './createBrowserProviders';
import { buildContractProviders } from './contractProviders';
import type { CESFlowStatus, CurrencySelectionState, OfferConfirmationState } from './types';
import { config } from '../../config';
import * as Counter from '../../../contracts/counter/out/contract/index.js';

type CounterContract = Counter.Contract<undefined, Counter.Witnesses<undefined>>;
type CounterCircuitId = 'increment';

function createCounterContract(): CounterContract {
  const witnesses: Counter.Witnesses<undefined> = {};
  return new Counter.Contract(witnesses);
}

function toUserErrorMessage(err: unknown): string {
  if (err instanceof CapacityExchangeUserCancelledError) {
    return 'Transaction cancelled';
  }
  if (err instanceof CapacityExchangeNoPricesAvailableError) {
    return 'No capacity exchange prices available';
  }
  return err instanceof Error ? err.message : 'Unknown error';
}

async function findAndIncrementCounter(
  providers: BrowserProviders,
  contractAddress: string,
  promptForCurrency: PromptForCurrency,
  confirmOffer: ConfirmOffer
) {
  const { contractProviders, zkConfigProvider } = buildContractProviders<CounterCircuitId>(
    providers,
    providers.walletProvider,
    '/midnight/counter'
  );

  const cesWalletProvider = capacityExchangeWalletProvider({
    walletProvider: providers.walletProvider,
    connectedAPI: providers.connectedAPI,
    proofProvider: providers.proofProvider,
    zkConfigProvider,
    indexerUrl: config.indexerUrl,
    capacityExchangeUrls: [config.capacityExchangeUrl],
    promptForCurrency,
    confirmOffer,
    circuitId: 'increment',
  });

  contractProviders.walletProvider = cesWalletProvider;

  const contract = createCounterContract();
  await findDeployedContract(contractProviders, { contract, contractAddress });
  await submitCallTx(contractProviders, { contract, contractAddress, circuitId: 'increment' });
}

export interface UseCESTransactionResult {
  status: CESFlowStatus;
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

export function useCESTransaction(
  providers: BrowserProviders | null,
  contractAddress: string | null
): UseCESTransactionResult {
  const [status, setStatus] = useState<CESFlowStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [currencySelection, setCurrencySelection] = useState<CurrencySelectionState | null>(null);
  const [offerConfirmation, setOfferConfirmation] = useState<OfferConfirmationState | null>(null);

  const currencyResolverRef = useRef<PromiseResolvers<CurrencySelectionResult> | null>(null);
  const offerResolverRef = useRef<PromiseResolvers<OfferConfirmationResult> | null>(null);

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

    try {
      const promptForCurrency: PromptForCurrency = async (prices, dustRequired) => {
        setStatus('selecting-currency');
        setCurrencySelection({ prices, dustRequired });
        return new Promise((resolve, reject) => {
          currencyResolverRef.current = { resolve, reject };
        });
      };

      const confirmOffer: ConfirmOffer = async (offer, dustRequired) => {
        setCurrencySelection(null);
        setStatus('confirming');
        setOfferConfirmation({ offer, dustRequired });
        return new Promise((resolve, reject) => {
          offerResolverRef.current = { resolve, reject };
        });
      };

      await findAndIncrementCounter(providers, contractAddress, promptForCurrency, confirmOffer);
      setStatus('success');
    } catch (err) {
      console.error('[CESTransaction] Error:', err);
      setError(toUserErrorMessage(err));
      setStatus('error');
      setCurrencySelection(null);
    }
  }, [providers, contractAddress]);

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
