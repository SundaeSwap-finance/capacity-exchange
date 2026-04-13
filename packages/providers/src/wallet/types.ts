import type { CoinPublicKey, EncPublicKey } from '@midnight-ntwrk/ledger-v8';
import type { CesApi } from './exchangeApi';

/**
 * A price which the caller may pay to sponsor their transaction.
 */
export interface ExchangePrice {
  exchangeApi: CesApi;
  /**
   * A unique identifier for this price.
   */
  quoteId: string;
  /**
   * Information about what the user must pay.
   */
  price: {
    /**
     * The currency in which to pay this price.
     */
    currency: Currency;
    /**
     * An amount, in the smallest denomination of that token.
     */
    amount: string;
  };
}

/**
 * A currency which the user may pay in.
 */
export interface Currency {
  /**
   * A unique identifier for this currency.
   */
  id: string;
  /**
   * What form of currency this is (i.e. midnight:shielded).
   */
  type: string;
  /**
   * The raw identifier for this currency.
   * For shielded tokens, a 32-byte hex-encoded token identifier.
   */
  rawId: string;
}

/**
 * An offer from the server, to pay the caller's DUST in exchange for some currency.
 */
export interface Offer {
  /**
   * A unique identifier for this offer.
   */
  offerId: string;
  /**
   * The amount of some currency which the caller must pay.
   */
  offerAmount: string;
  /**
   * The currency which the caller must pay.
   */
  offerCurrency: Currency;
  /**
   * A serialized Midnight transaction for the caller.
   * Includes a DUST spend, as well as a transfer of some token.
   */
  serializedTx: string;
  /**
   * When does `serializedTx` expire.
   */
  expiresAt: Date;
}

export type CurrencySelectionResult =
  | {
      /** The user will pay the given price. */
      status: 'selected';
      exchangePrice: ExchangePrice;
    }
  | {
      /** The user will not pay, and will not submit the transaction. */
      status: 'cancelled';
    };

export type OfferConfirmationResult =
  | {
      /** The user will accept the given offer. */
      status: 'confirmed';
    }
  | {
      /** The user will not accept the given offer, but would like to choose a different currency to pay with. */
      status: 'back';
    }
  | {
      /** The user will not accept the given offer, and will not submit the transaction. */
      status: 'cancelled';
    };

export type PromptForCurrency = (
  prices: ExchangePrice[],
  dustRequired: bigint,
  requestId: string
) => Promise<CurrencySelectionResult>;

export type ConfirmOffer = (offer: Offer, dustRequired: bigint, requestId: string) => Promise<OfferConfirmationResult>;

export type BalanceSealedTransaction = (tx: string) => Promise<{ tx: string }>;

export interface CapacityExchangeConfig {
  /**
   * The ID of the midnight network you're connecting to. Usually `preview`, `preprod`, or `mainnet`.
   */
  networkId: string;
  /**
   * The `shieldedCoinPublicKey` from the user's wallet.
   */
  coinPublicKey: CoinPublicKey;
  /**
   * The `shieldedEncryptionPublicKey` from the user's wallet.
   */
  encryptionPublicKey: EncPublicKey;
  /**
   * The `balanceSealedTransaction` method from the user's wallet.
   */
  balanceSealedTransaction: BalanceSealedTransaction;
  /**
   * An indexer URL for the given environment.
   */
  indexerUrl: string;
  /**
   * Optional: any additional capacity exchange URLs to call,
   * in addition to the default members of the network.
   */
  additionalCapacityExchangeUrls?: string[];
  /**
   * Optional: A safety margin in blocks, used when estimating fees.
   * Defaults to 3.
   */
  margin?: number;
  /**
   * A function called when the user must choose which currency to pay.
   * Returns the user's decision.
   */
  promptForCurrency: PromptForCurrency;
  /**
   * A function called when the user has received an offer and must confirm it's acceptable.
   * Returns the user's decision.
   */
  confirmOffer: ConfirmOffer;
}

export interface SponsoredTransactionsConfig {
  /**
   * The `shieldedCoinPublicKey` from the user's wallet.
   */
  coinPublicKey: CoinPublicKey;
  /**
   * The `shieldedEncryptionPublicKey` from the user's wallet.
   */
  encryptionPublicKey: EncPublicKey;
  /**
   * The URL of the capacity exchange server sponsoring these transactions.
   */
  capacityExchangeUrl: string;
}
