import type { UnboundTransaction } from '@midnight-ntwrk/midnight-js/types';
import type { FinalizedTransaction } from '@midnight-ntwrk/ledger-v8';
import type { ExchangePrice } from './types.js';

// Bridgeless payment: pay for a Midnight tx with a foreign-chain asset escrowed against a
// hashlock, with an LP fronting the DUST. The Midnight coupling is chain-agnostic, only the
// foreign escrow differs per chain. The provider speaks one chain-agnostic payer interface and the
// caller registers one payer per currency.

/** The cap-ex server that issued a quote, identified by its URL (the address it is reached at).
 *  The payer resolves it to a client. */
export type ExchangeRef = string;

/** What the payer needs to originate one swap: the LP's quote, the amount and currency to escrow,
 *  and which server issued it. */
export interface BridgelessQuote {
  /** The LP-issued signed quote token. */
  quoteId: string;
  /** Amount to escrow, in the currency's smallest denomination. */
  amount: string;
  /** The foreign currency type being paid, e.g. `cardano:`. */
  currencyType: string;
  /** The server that issued the quote. */
  exchange: ExchangeRef;
}

/** Build the payer's quote from a selected price. */
export function bridgelessQuoteFromPrice(price: ExchangePrice): BridgelessQuote {
  return {
    quoteId: price.quoteId,
    amount: price.price.amount,
    currencyType: price.price.currency.type,
    exchange: price.exchangeApi.url,
  };
}

/** Pays one foreign-chain currency for a Midnight tx, injected into the WalletProvider. Originates
 *  the swap and returns a bound tx ready to submit. `dustSpecks` is the dust the tx needs. */
export interface BridgelessPayer {
  pay(userTx: UnboundTransaction, quote: BridgelessQuote, dustSpecks: bigint): Promise<FinalizedTransaction>;
}

/** Payers keyed by currency type (e.g. `cardano:`). */
export type BridgelessPayers = Record<string, BridgelessPayer>;
