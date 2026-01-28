import type { WalletProvider, ProofProvider, ZKConfigProvider } from '@midnight-ntwrk/midnight-js-types';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';

export interface Price {
  currency: string;
  amount: string;
}

export interface Offer {
  offerId: string;
  offerAmount: string;
  offerCurrency: string;
  serializedTx: string;
  expiresAt: string;
}

export type CurrencySelectionResult =
  | { status: 'selected'; currency: string }
  | { status: 'cancelled' };

export type OfferConfirmationResult =
  | { status: 'confirmed' }
  | { status: 'back' }
  | { status: 'cancelled' };

export type PromptForCurrency = (
  prices: Price[],
  dustRequired: bigint
) => Promise<CurrencySelectionResult>;

export type ConfirmOffer = (
  offer: Offer,
  dustRequired: bigint
) => Promise<OfferConfirmationResult>;

export interface CapacityExchangeConfig {
  walletProvider: WalletProvider;
  connectedAPI: ConnectedAPI;
  proofProvider: ProofProvider<string>;
  zkConfigProvider: ZKConfigProvider<string>;
  indexerUrl: string;
  capacityExchangeUrl: string;
  promptForCurrency: PromptForCurrency;
  confirmOffer: ConfirmOffer;
}
