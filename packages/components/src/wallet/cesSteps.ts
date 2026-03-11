import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import type { UnboundTransaction } from '@midnight-ntwrk/midnight-js-types';
import {
  Transaction,
  type SignatureEnabled,
  type Proof,
  type PreBinding,
  type Binding,
  type FinalizedTransaction,
} from '@midnight-ntwrk/ledger-v7';
import type { ExchangePrice, Offer } from './types';
import { isOfferExpired } from './utils';
import { getLedgerParameters, hexToBytes, uint8ArrayToHex } from '@capacity-exchange/midnight-core';
import { createCesApis } from './exchangeApi';
import { fetchPricesFromExchanges } from './priceService';
import type { ApiOffersPost201Response } from '@capacity-exchange/client';
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
  capacityExchangeUrls: string[],
  margin: number
): Promise<FetchCesPricesResult> {
  console.debug('[CESSteps] Fetching ledger parameters from:', indexerUrl);
  const ledgerParameters = await getLedgerParameters(indexerUrl);
  const specksRequired = tx.feesWithMargin(ledgerParameters, margin);
  console.debug('[CESSteps] Specks required (with margin):', specksRequired.toString());

  const exchangeApis = createCesApis(capacityExchangeUrls);
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
export async function requestCesOffer(exchangePrice: ExchangePrice, specksRequired: bigint): Promise<Offer> {
  console.debug('[CESSteps] Requesting offer from exchange:', exchangePrice.exchangeApi.url);
  const offerResponse = await exchangePrice.exchangeApi.api.apiOffersPost({
    apiOffersPostRequest: {
      specks: specksRequired.toString(),
      offerCurrency: exchangePrice.price.currency,
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
  connectedAPI: ConnectedAPI
): Promise<FinalizedTransaction> {
  console.debug('[CESSteps] Processing transaction for offer:', offer.offerId);
  const txBytes = hexToBytes(offer.serializedTx);
  const dustTx = Transaction.deserialize<SignatureEnabled, Proof, PreBinding>(
    'signature',
    'proof',
    'pre-binding',
    txBytes
  ).bind();
  console.debug('[CESSteps] DUST transaction deserialized');

  console.debug('[CESSteps] Binding and merging transactions');
  const boundTx = tx.bind();
  const mergedTx = boundTx.merge(dustTx);
  const serializedStr = uint8ArrayToHex(mergedTx.serialize());
  console.debug('[CESSteps] Transactions merged, calling wallet to balance and seal');

  const result = await connectedAPI.balanceSealedTransaction(serializedStr);
  console.debug('[CESSteps] Wallet balanced and sealed transaction');

  const resultBytes = hexToBytes(result.tx);
  const transaction = Transaction.deserialize<SignatureEnabled, Proof, Binding>(
    'signature',
    'proof',
    'binding',
    resultBytes
  ).bind();

  console.debug('[CESSteps] Transaction processing complete');
  return transaction;
}
