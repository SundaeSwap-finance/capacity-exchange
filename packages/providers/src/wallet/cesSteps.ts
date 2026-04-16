import type { UnboundTransaction } from '@midnight-ntwrk/midnight-js-types';
import {
  Proof,
  SignatureEnabled,
  Transaction,
  type Binding,
  type FinalizedTransaction,
} from '@midnight-ntwrk/ledger-v8';
import type { ExchangePrice, Offer, BalanceSealedTransaction, BalanceUnsealedTransaction } from './types';
import { isOfferExpired } from './utils';
import { getLedgerParameters, hexToBytes } from '@sundaeswap/capacity-exchange-core';
import { createCesApis, resolveCesUrls } from './exchangeApi';
import { fetchPricesFromExchanges } from './priceService';
import type { ApiOffersPost201Response } from '@sundaeswap/capacity-exchange-client';
import { CapacityExchangeNoPricesAvailableError, CapacityExchangeOfferExpiredError } from './errors';

function convertToOffer(offerResponse: ApiOffersPost201Response): Offer {
  return {
    offerId: offerResponse.offerId,
    offerAmount: offerResponse.offerAmount,
    offerCurrency: offerResponse.offerCurrency,
    serializedTx: offerResponse.serializedTx,
    expiresAt: offerResponse.expiresAt,
  };
}

export interface FetchCesPricesResult {
  prices: ExchangePrice[];
  specksRequired: bigint;
}

/**
 * Fetches CES prices for a transaction.
 * Calculates the DUST required (with margin) and queries all exchanges for prices.
 *
 * @throws {CapacityExchangeNoPricesAvailableError} if no prices are returned
 */
export async function fetchCesPrices(
  tx: UnboundTransaction,
  indexerUrl: string,
  networkId: string,
  additionalCapacityExchangeUrls: string[],
  margin: number
): Promise<FetchCesPricesResult> {
  console.debug('[CESSteps] Fetching ledger parameters from:', indexerUrl);
  const ledgerParameters = await getLedgerParameters(indexerUrl);

  const estimated = tx.feesWithMargin(ledgerParameters, margin);
  // Ensure at least 1 speck so the CES provides a real dust input for the merged tx
  const specksRequired = estimated > 0n ? estimated : 1n;
  console.debug(
    '[CESSteps] Specks required (with margin):',
    specksRequired.toString(),
    estimated === 0n ? '(floored from 0)' : ''
  );

  const urls = resolveCesUrls(networkId, additionalCapacityExchangeUrls);
  const exchangeApis = createCesApis(urls);
  const prices = await fetchPricesFromExchanges(exchangeApis, specksRequired);

  if (prices.length === 0) {
    throw new CapacityExchangeNoPricesAvailableError();
  }

  return { prices, specksRequired };
}

/**
 * Requests an offer from a CES exchange for the selected currency.
 *
 * @throws {CapacityExchangeOfferExpiredError} if the offer is already expired
 */
export async function requestCesOffer(exchangePrice: ExchangePrice): Promise<Offer> {
  console.debug('[CESSteps] Requesting offer from exchange:', exchangePrice.exchangeApi.url);
  const offerResponse = await exchangePrice.exchangeApi.api.apiOffersPost({
    apiOffersPostRequest: {
      quoteId: exchangePrice.quoteId,
      offerCurrency: exchangePrice.price.currency.id,
    },
  });
  console.debug('[CESSteps] Offer received:', offerResponse);

  const offer = convertToOffer(offerResponse);

  if (isOfferExpired(offer.expiresAt)) {
    throw new CapacityExchangeOfferExpiredError(offer);
  }

  return offer;
}

/**
 * Processes the user transaction with the confirmed offer.
 * Binds the tx, merges with the dust tx from the offer, then has the wallet balance and seal.
 */
export async function processTransactionWithOffer(
  tx: UnboundTransaction,
  offer: Offer,
  balanceUnsealedTransaction: BalanceUnsealedTransaction,
  balanceSealedTransaction: BalanceSealedTransaction
): Promise<FinalizedTransaction> {
  console.debug('[CESSteps] Processing transaction for offer:', offer.offerId);
  const dustTxBytes = hexToBytes(offer.serializedTx);
  const dustTx = Transaction.deserialize<SignatureEnabled, Proof, Binding>(
    'signature',
    'proof',
    'binding',
    dustTxBytes
  );
  console.debug('[CESSteps] DUST transaction deserialized');

  console.debug('[CESSteps] Balancing user transaction');
  const txHex = Buffer.from(tx.serialize()).toString('hex');
  const { tx: balancedTxHex } = await balanceUnsealedTransaction(txHex);
  const balancedTxBytes = hexToBytes(balancedTxHex);
  const balancedTx = Transaction.deserialize<SignatureEnabled, Proof, Binding>(
    'signature',
    'proof',
    'binding',
    balancedTxBytes
  );
  console.debug('[CESSteps] User transaction balanced');

  console.debug('[CESSteps] Binding and merging transactions');
  const mergedTx = balancedTx.merge(dustTx);
  console.debug('[CESSteps] Transactions merged, calling wallet to balance');

  const mergedTxHex = Buffer.from(mergedTx.serialize()).toString('hex');
  const { tx: result } = await balanceSealedTransaction(mergedTxHex);
  console.debug('[CESSteps] Wallet balanced and sealed transaction');

  console.debug('[CESSteps] Transaction processing complete');
  return Transaction.deserialize<SignatureEnabled, Proof, Binding>('signature', 'proof', 'binding', hexToBytes(result));
}
