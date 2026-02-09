import type { WalletProvider, ProofProvider, ZKConfigProvider } from '@midnight-ntwrk/midnight-js-types';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import type { ExchangeApi } from './exchangeApi';

export const DEFAULT_MARGIN = 3;

export interface ExchangePrice {
  exchangeApi: ExchangeApi;
  price: {
    currency: string;
    amount: string;
  };
}

export interface Offer {
  offerId: string;
  offerAmount: string;
  offerCurrency: string;
  serializedTx: string;
  expiresAt: Date;
}

export type CurrencySelectionResult = { status: 'selected'; exchangePrice: ExchangePrice } | { status: 'cancelled' };

export type OfferConfirmationResult = { status: 'confirmed' } | { status: 'back' } | { status: 'cancelled' };

export type PromptForCurrency = (prices: ExchangePrice[], dustRequired: bigint) => Promise<CurrencySelectionResult>;

export type ConfirmOffer = (offer: Offer, dustRequired: bigint) => Promise<OfferConfirmationResult>;

export type SelectAndConfirmOfferResult =
  | { status: 'success'; offer: Offer }
  | { status: 'userCancelled' }
  | { status: 'offerExpired'; offer: Offer };

export interface CapacityExchangeConfig {
  walletProvider: WalletProvider;
  connectedAPI: ConnectedAPI;
  proofProvider: ProofProvider<string>;
  zkConfigProvider: ZKConfigProvider<string>;
  indexerUrl: string;
  capacityExchangeUrls: string[];
  margin?: number;
  promptForCurrency: PromptForCurrency;
  confirmOffer: ConfirmOffer;
  circuitId: string;
}
