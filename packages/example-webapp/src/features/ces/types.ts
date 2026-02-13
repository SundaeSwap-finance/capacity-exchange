import type {
  ExchangePrice,
  Offer,
  CurrencySelectionResult,
  OfferConfirmationResult,
} from '@capacity-exchange/components';

export type CesFlowStatus =
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
  specksRequired: bigint;
}

export interface OfferConfirmationState {
  offer: Offer;
  specksRequired: bigint;
}

export interface CesTransactionState {
  status: CesFlowStatus;
  error: string | null;
  currencySelection: CurrencySelectionState | null;
  offerConfirmation: OfferConfirmationState | null;
}

export type { ExchangePrice, Offer, CurrencySelectionResult, OfferConfirmationResult };
