import {
  CapacityExchangeConfig as CapacityExchangeImplConfig,
  capacityExchangeWalletProvider as capacityExchangeWalletProviderImpl,
  ConfirmOffer,
  CurrencySelectionResult,
  OfferConfirmationResult,
  PromptForCurrency,
} from '@capacity-exchange/providers';
import { WalletProvider } from '@midnight-ntwrk/midnight-js-types';
import { useCapacityExchangeContext } from '../stores/CapacityExchangeContext/context';
import { useCallback, useMemo } from 'react';

export type CapacityExchangeConfig = Omit<CapacityExchangeImplConfig, 'promptForCurrency' | 'confirmOffer'>;

export function useCapacityExchangeWalletProvider(config: CapacityExchangeConfig): WalletProvider {
  const { dispatch } = useCapacityExchangeContext();

  const promptForCurrency: PromptForCurrency = useCallback(
    async (prices, dustRequired) => {
      const result = await new Promise<CurrencySelectionResult>((resolve) => {
        dispatch({
          action: 'prompt-for-currency',
          payload: {
            prices,
            dustRequired,
            onSelected: (exchangePrice) => resolve({ status: 'selected', exchangePrice }),
            onCancelled: () => resolve({ status: 'cancelled' }),
          },
        });
      });
      if (result.status === 'cancelled') {
        dispatch({ action: 'finish' });
      }
      return result;
    },
    [dispatch]
  );

  const confirmOffer: ConfirmOffer = useCallback(
    async (offer, dustRequired) => {
      const result = await new Promise<OfferConfirmationResult>((resolve) => {
        dispatch({
          action: 'confirm-offer',
          payload: {
            offer,
            dustRequired,
            onConfirmed: () => resolve({ status: 'confirmed' }),
            onBack: () => resolve({ status: 'back' }),
            onCancelled: () => resolve({ status: 'cancelled' }),
          },
        });
      });
      dispatch({ action: 'finish' });
      return result;
    },
    [dispatch]
  );

  return useMemo(() => {
    return capacityExchangeWalletProviderImpl({
      ...config,
      promptForCurrency,
      confirmOffer,
    });
  }, [
    config.coinPublicKey,
    config.encryptionPublicKey,
    config.indexerUrl,
    ...config.capacityExchangeUrls,
    config.margin,
    promptForCurrency,
    confirmOffer,
  ]);
}
