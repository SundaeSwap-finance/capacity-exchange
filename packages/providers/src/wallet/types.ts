import type { WalletProvider } from '@midnight-ntwrk/midnight-js-types';
import type { CoinPublicKey, EncPublicKey } from '@midnight-ntwrk/ledger-v8';
import type { CesApi } from './exchangeApi';

export const DEFAULT_MARGIN = 3;

export interface ExchangePrice {
  exchangeApi: CesApi;
  quoteId: string;
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

export type PromptForCurrency = (
  prices: ExchangePrice[],
  dustRequired: bigint,
  requestId: string
) => Promise<CurrencySelectionResult>;

export type ConfirmOffer = (offer: Offer, dustRequired: bigint, requestId: string) => Promise<OfferConfirmationResult>;

export type BalanceSealedTransaction = (tx: string) => Promise<{ tx: string }>;

export interface CapacityExchangeConfig {
  coinPublicKey: CoinPublicKey;
  encryptionPublicKey: EncPublicKey;
  balanceSealedTransaction: BalanceSealedTransaction;
  indexerUrl: string;
  capacityExchangeUrls: string[];
  margin: number;
  promptForCurrency: PromptForCurrency;
  confirmOffer: ConfirmOffer;
}

export interface SponsoredTransactionsConfig {
  walletProvider: WalletProvider;
  capacityExchangeUrl: string;
}
