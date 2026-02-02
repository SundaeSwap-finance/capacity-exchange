import { useState, useRef, useCallback } from 'react';
import { findDeployedContract, submitCallTx } from '@midnight-ntwrk/midnight-js-contracts';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import {
  capacityExchangeWalletProvider,
  type ExchangePrice,
  type Offer,
  type CurrencySelectionResult,
  type OfferConfirmationResult,
  type PromptForCurrency,
  type ConfirmOffer,
  CapacityExchangeUserCancelledError,
  CapacityExchangeNoPricesAvailableError,
} from '@capacity-exchange/components';
import type { BrowserProviders } from './createBrowserProviders';
import type {
  CESFlowStatus,
  CurrencySelectionState,
  OfferConfirmationState,
} from './types';
import { config } from '../../config';

// Import counter contract
import * as Counter from '../../../contracts/counter/out/contract/index.js';

type CounterContract = Counter.Contract<undefined, Counter.Witnesses<undefined>>;
type CounterCircuitId = 'increment';

function createCounterContract(): CounterContract {
  const witnesses: Counter.Witnesses<undefined> = {};
  return new Counter.Contract(witnesses);
}

export interface UseCESTransactionResult {
  status: CESFlowStatus;
  error: string | null;

  currencySelection: CurrencySelectionState | null;
  onCurrencySelected: (result: CurrencySelectionResult) => void;

  offerConfirmation: OfferConfirmationState | null;
  onOfferConfirmed: (result: OfferConfirmationResult) => void;

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
    setCurrencySelection(null);
  }, []);

  const onOfferConfirmed = useCallback((result: OfferConfirmationResult) => {
    if (offerResolverRef.current) {
      offerResolverRef.current.resolve(result);
      offerResolverRef.current = null;
    }
    setOfferConfirmation(null);
  }, []);

  const incrementCounter = useCallback(async () => {
    if (!providers || !contractAddress) {
      setError('Providers or contract address not available');
      return;
    }

    setStatus('building');
    setError(null);

    try {
      const promptForCurrency: PromptForCurrency = async (
        prices: ExchangePrice[],
        dustRequired: bigint
      ): Promise<CurrencySelectionResult> => {
        console.debug('[CESTransaction] Currency selection prompt with', prices.length, 'options');
        console.debug('[CESTransaction] DUST required:', dustRequired.toString());
        prices.forEach((p, i) => {
          console.debug(`[CESTransaction]   Option ${i}: ${p.price.currency} = ${p.price.amount}`);
        });
        setStatus('selecting-currency');
        setCurrencySelection({ prices, dustRequired });

        const result = await new Promise<CurrencySelectionResult>((resolve, reject) => {
          currencyResolverRef.current = { resolve, reject };
        });
        console.debug('[CESTransaction] Currency selection result:', result);
        if (result.status === 'selected') {
          console.debug('[CESTransaction] Selected currency:', result.exchangePrice.price.currency);
          console.debug('[CESTransaction] *** This token type must exist in wallet balances ***');
        }
        return result;
      };

      const confirmOffer: ConfirmOffer = async (
        offer: Offer,
        dustRequired: bigint
      ): Promise<OfferConfirmationResult> => {
        console.debug('[CESTransaction] Offer confirmation prompt');
        console.debug('[CESTransaction] Offer ID:', offer.offerId);
        console.debug('[CESTransaction] Offer currency (TOKEN TYPE TO PAY):', offer.offerCurrency);
        console.debug('[CESTransaction] Offer amount:', offer.offerAmount);
        console.debug('[CESTransaction] DUST required:', dustRequired.toString());
        setStatus('confirming');
        setOfferConfirmation({ offer, dustRequired });

        const result = await new Promise<OfferConfirmationResult>((resolve, reject) => {
          offerResolverRef.current = { resolve, reject };
        });
        console.debug('[CESTransaction] Offer confirmation result:', result);
        return result;
      };

      // Create ZK config provider for browser
      const zkConfigHttpBase = window.location.origin + '/midnight/counter';
      const zkConfigProvider = new FetchZkConfigProvider<CounterCircuitId>(
        zkConfigHttpBase,
        fetch.bind(window)
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

      const publicDataProvider = indexerPublicDataProvider(
        config.indexerUrl,
        config.indexerWsUrl
      );

      // Create private state provider (counter has no private state, but API requires it)
      const privateStateProvider = levelPrivateStateProvider({
        walletProvider: cesWalletProvider,
      });

      const contractProviders = {
        midnightProvider: providers.midnightProvider,
        privateStateProvider,
        proofProvider: providers.proofProvider,
        publicDataProvider,
        walletProvider: cesWalletProvider,
        zkConfigProvider,
      };

      const contract = createCounterContract();

      console.debug('[CESTransaction] Contract address:', contractAddress);
      console.debug('[CESTransaction] Indexer URL:', config.indexerUrl);
      console.debug('[CESTransaction] Finding deployed contract...');

      try {
        await findDeployedContract(contractProviders, {
          contract,
          contractAddress,
        });
        console.debug('[CESTransaction] Found deployed contract successfully');
      } catch (findErr) {
        console.error('[CESTransaction] findDeployedContract failed:', findErr);
        console.error('[CESTransaction] Full error stack:', findErr instanceof Error ? findErr.stack : 'No stack');
        throw findErr;
      }

      console.debug('[CESTransaction] Submitting increment call...');
      setStatus('submitting');

      try {
        const result = await submitCallTx(contractProviders, {
          contract,
          contractAddress,
          circuitId: 'increment',
        });
        console.debug('[CESTransaction] Increment succeeded:', result);
        setStatus('success');
      } catch (submitErr) {
        console.error('[CESTransaction] submitCallTx failed:', submitErr);
        console.error('[CESTransaction] Full error stack:', submitErr instanceof Error ? submitErr.stack : 'No stack');
        throw submitErr;
      }
    } catch (err) {
      console.error('[CESTransaction] Error:', err);
      console.error('[CESTransaction] Error type:', err?.constructor?.name);
      if (err instanceof Error) {
        console.error('[CESTransaction] Full stack trace:', err.stack);
      }

      if (err instanceof CapacityExchangeUserCancelledError) {
        setError('Transaction cancelled');
      } else if (err instanceof CapacityExchangeNoPricesAvailableError) {
        setError('No capacity exchange prices available');
      } else {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }

      setStatus('error');
      setCurrencySelection(null);
      setOfferConfirmation(null);
    }
  }, [providers, contractAddress]);

  return {
    status,
    error,
    currencySelection,
    onCurrencySelected,
    offerConfirmation,
    onOfferConfirmed,
    incrementCounter,
  };
}
