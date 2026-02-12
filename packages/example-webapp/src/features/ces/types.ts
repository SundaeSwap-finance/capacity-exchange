import type {
  ExchangePrice,
  Offer,
  CurrencySelectionResult,
  OfferConfirmationResult,
} from '@capacity-exchange/components';

export type CESFlowStatus =
  | 'idle'
  | 'building'
  | 'selecting-currency'
  | 'fetching-offers'
  | 'confirming'
  | 'submitting'
  | 'success'
  | 'error';

export interface CurrencySelectionState {
  prices: ExchangePrice[];
  dustRequired: bigint;
}

export interface OfferConfirmationState {
  offer: Offer;
  dustRequired: bigint;
}

export interface CESTransactionState {
  status: CESFlowStatus;
  error: string | null;
  currencySelection: CurrencySelectionState | null;
  offerConfirmation: OfferConfirmationState | null;
}

export type { ExchangePrice, Offer, CurrencySelectionResult, OfferConfirmationResult };
