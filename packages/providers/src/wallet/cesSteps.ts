import type { UnboundTransaction } from '@midnight-ntwrk/midnight-js-types';
import {
  Intent,
  Proof,
  SignatureEnabled,
  Transaction,
  type Binding,
  type FinalizedTransaction,
} from '@midnight-ntwrk/ledger-v8';
import type { ExchangePrice, Offer, BalanceSealedTransaction, BalanceUnsealedTransaction } from './types';
import type { ChainStateProvider } from './chainStateProvider';
import { isOfferExpired } from './utils';
import { hexToBytes, toRawTokenType } from '@sundaeswap/capacity-exchange-core';
import { createCesApis, getDefaultRegistryAddress, resolveCesUrls } from './exchangeApi';
import { fetchRegistryCesUrls } from './registryLookup';
import { fetchPricesFromExchanges } from './priceService';
import type { ApiOffersPost201Response } from '@sundaeswap/capacity-exchange-client';
import {
  CapacityExchangeNoPricesAvailableError,
  CapacityExchangeOfferMismatchError,
  CapacityExchangeOfferExpiredError,
  CapacityExchangeOfferTransactionInvalidError,
} from './errors';

function deserializeTx(hex: Uint8Array): Transaction<SignatureEnabled, Proof, Binding> {
  return Transaction.deserialize<SignatureEnabled, Proof, Binding>('signature', 'proof', 'binding', hex);
}

/**
 * Deserializes a CES offer tx and validates the common structure:
 * exactly 1 intent, no contract calls, dustActions present.
 * */
function parseOfferTx(serializedTx: string, offerId: string) {
  let tx: Transaction<SignatureEnabled, Proof, Binding>;
  try {
    tx = deserializeTx(hexToBytes(serializedTx));
  } catch {
    throw new CapacityExchangeOfferTransactionInvalidError(offerId, 'transaction could not be deserialized');
  }
  if (!tx.intents || tx.intents.size !== 1) {
    throw new CapacityExchangeOfferTransactionInvalidError(
      offerId,
      `expected exactly 1 intent, got ${tx.intents?.size ?? 0}`
    );
  }
  const [intent] = tx.intents.values();
  if (intent.actions.length > 0) {
    throw new CapacityExchangeOfferTransactionInvalidError(offerId, 'contains unexpected contract calls');
  }
  if (!intent.dustActions) {
    throw new CapacityExchangeOfferTransactionInvalidError(offerId, 'intent is missing expected dust actions');
  }
  return { tx, intent };
}

/** Validates the unshielded offer in an intent. */
function validateUnshieldedOffer(
  intent: Intent<SignatureEnabled, Proof, Binding>,
  offerId: string,
  expectedRawTokenType: string,
  expectedAmount: bigint
): void {
  if (intent.fallibleUnshieldedOffer) {
    throw new CapacityExchangeOfferTransactionInvalidError(
      offerId,
      'contains a fallible unshielded offer; a guaranteed unshielded offer is required'
    );
  }
  if (!intent.guaranteedUnshieldedOffer) {
    throw new CapacityExchangeOfferTransactionInvalidError(offerId, 'missing expected guaranteed unshielded offer');
  }
  const { outputs } = intent.guaranteedUnshieldedOffer;
  if (outputs.length !== 1) {
    throw new CapacityExchangeOfferTransactionInvalidError(
      offerId,
      `expected exactly 1 unshielded output, got ${outputs.length}`
    );
  }
  const [output] = outputs;
  if (output.type !== expectedRawTokenType) {
    throw new CapacityExchangeOfferTransactionInvalidError(
      offerId,
      'unshielded offer does not contain the expected token'
    );
  }
  if (output.value !== expectedAmount) {
    throw new CapacityExchangeOfferTransactionInvalidError(offerId, 'unshielded offer amount does not match');
  }
}

/** Validates the shielded ZswapOffer on a tx */
function validateShieldedOffer(
  tx: Transaction<SignatureEnabled, Proof, Binding>,
  offerId: string,
  expectedRawId: string,
  expectedAmount: bigint
): void {
  if (tx.fallibleOffer) {
    throw new CapacityExchangeOfferTransactionInvalidError(
      offerId,
      'contains a fallible offer; a guaranteed shielded offer is required'
    );
  }
  if (!tx.guaranteedOffer) {
    throw new CapacityExchangeOfferTransactionInvalidError(offerId, 'missing expected guaranteed shielded offer');
  }
  if (tx.guaranteedOffer.deltas.size !== 1) {
    throw new CapacityExchangeOfferTransactionInvalidError(
      offerId,
      `expected exactly 1 token in shielded offer deltas, got ${tx.guaranteedOffer.deltas.size}`
    );
  }
  const delta = tx.guaranteedOffer.deltas.get(expectedRawId);
  if (delta === undefined) {
    throw new CapacityExchangeOfferTransactionInvalidError(
      offerId,
      'shielded offer does not contain the expected token'
    );
  }
  // Delta is input - output. The CES provides an output but no input, so delta must be -expectedAmount.
  if (delta !== -expectedAmount) {
    throw new CapacityExchangeOfferTransactionInvalidError(offerId, 'shielded offer amount does not match');
  }
}

function validateOfferTx(
  serializedTx: string,
  offerId: string,
  price: { currency: { type: string; rawId: string }; amount: string }
): void {
  const { tx, intent } = parseOfferTx(serializedTx, offerId);
  const expectedAmount = BigInt(price.amount);

  if (price.currency.type === 'midnight:shielded') {
    // use the tx, since the guaranteed shielded offer
    // (where the deltas are located) can be accessed through it.
    validateShieldedOffer(tx, offerId, price.currency.rawId, expectedAmount);

    // for shielded offers, the presence of any unshielded offer is unexpected/invalid.
    if (intent.guaranteedUnshieldedOffer || intent.fallibleUnshieldedOffer) {
      throw new CapacityExchangeOfferTransactionInvalidError(offerId, 'contains unexpected unshielded offer');
    }
  } else if (price.currency.type === 'midnight:unshielded') {
    // use the intent, since the guaranteed unshielded offer
    // (where the `utxoOutput` is located) can be accessed through it.
    validateUnshieldedOffer(intent, offerId, toRawTokenType(price.currency.rawId), expectedAmount);

    // for unshielded offers, the presence of any shielded offer is unexpected/invalid.
    if (tx.guaranteedOffer || tx.fallibleOffer) {
      throw new CapacityExchangeOfferTransactionInvalidError(offerId, 'contains unexpected shielded offer');
    }
  } else {
    throw new CapacityExchangeOfferTransactionInvalidError(
      offerId,
      `unsupported currency type: ${price.currency.type}`
    );
  }
}

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

export interface FetchCesPricesOptions {
  networkId: string;
  chainStateProvider: ChainStateProvider;
  additionalCapacityExchangeUrls: string[];
  margin: number;
}

/**
 * Fetches CES prices for a transaction.
 * Calculates the DUST required (with margin) and queries all exchanges for prices.
 *
 * @throws {CapacityExchangeNoPricesAvailableError} if no prices are returned
 */
export async function fetchCesPrices(
  tx: UnboundTransaction,
  options: FetchCesPricesOptions
): Promise<FetchCesPricesResult> {
  const { networkId, chainStateProvider, additionalCapacityExchangeUrls, margin } = options;
  const specksRequired = await estimateSpecksRequired(tx, chainStateProvider, margin);
  const registeredUrls = await resolveRegisteredCesUrls(networkId, chainStateProvider);
  const urls = resolveCesUrls(networkId, additionalCapacityExchangeUrls, registeredUrls);
  const prices = await fetchPricesFromExchanges(createCesApis(urls), specksRequired);

  if (prices.length === 0) {
    throw new CapacityExchangeNoPricesAvailableError();
  }

  return { prices, specksRequired };
}

async function estimateSpecksRequired(
  tx: UnboundTransaction,
  chainStateProvider: ChainStateProvider,
  margin: number
): Promise<bigint> {
  const ledgerParameters = await chainStateProvider.getLedgerParameters();
  const estimated = tx.feesWithMargin(ledgerParameters, margin);
  // Ensure at least 1 speck so the CES provides a real dust input for the merged tx
  const specksRequired = estimated > 0n ? estimated : 1n;
  console.debug('[CESSteps] Specks required (with margin):', specksRequired.toString());
  return specksRequired;
}

async function resolveRegisteredCesUrls(networkId: string, chainStateProvider: ChainStateProvider): Promise<string[]> {
  const registryAddress = getDefaultRegistryAddress(networkId);
  if (!registryAddress) {
    console.debug('[CESSteps] No canonical registry address for network', networkId);
    return [];
  }
  try {
    console.debug('[CESSteps] Looking up registered CES URLs from registry', registryAddress);
    const urls = await fetchRegistryCesUrls(chainStateProvider, registryAddress);
    console.debug('[CESSteps] Registry returned', urls.length, 'URLs');
    return urls;
  } catch (err) {
    console.warn('[CESSteps] Registered CES URLs lookup failed, continuing without them:', err);
    return [];
  }
}

/**
 * Requests an offer from a CES exchange for the selected currency.
 *
 * @throws {CapacityExchangeOfferExpiredError} if the offer is already expired
 * @throws {CapacityExchangeOfferMismatchError} if the offer doesn't match the exchange price
 * @throws {CapacityExchangeOfferTransactionInvalidError} if the offer transaction is invalid for use
 */
export async function requestCesOffer(exchangePrice: ExchangePrice): Promise<Offer> {
  console.debug('[CESSteps] Requesting offer from exchange:', exchangePrice.exchangeApi.url);
  // WrappedDefaultApi already translates ResponseError → CapacityExchangeServerError.
  const offerResponse: ApiOffersPost201Response = await exchangePrice.exchangeApi.api.apiOffersPost({
    apiOffersPostRequest: {
      quoteId: exchangePrice.quoteId,
      offerCurrency: exchangePrice.price.currency.id,
    },
  });
  console.debug('[CESSteps] Offer received:', offerResponse);

  const offer = convertToOffer(offerResponse);

  // validate the offer
  if (isOfferExpired(offer.expiresAt)) {
    throw new CapacityExchangeOfferExpiredError(offer);
  }

  if (offer.offerAmount !== exchangePrice.price.amount || offer.offerCurrency.id !== exchangePrice.price.currency.id) {
    throw new CapacityExchangeOfferMismatchError({ price: exchangePrice.price }, offer);
  }

  validateOfferTx(offer.serializedTx, offer.offerId, exchangePrice.price);

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
  const dustTx = deserializeTx(hexToBytes(offer.serializedTx));
  console.debug('[CESSteps] DUST transaction deserialized');

  console.debug('[CESSteps] Balancing user transaction');
  const txHex = Buffer.from(tx.serialize()).toString('hex');
  const { tx: balancedTxHex } = await balanceUnsealedTransaction(txHex);
  const balancedTx = deserializeTx(hexToBytes(balancedTxHex));
  console.debug('[CESSteps] User transaction balanced');

  console.debug('[CESSteps] Binding and merging transactions');
  const mergedTx = balancedTx.merge(dustTx);
  console.debug('[CESSteps] Transactions merged, calling wallet to balance');

  const mergedTxHex = Buffer.from(mergedTx.serialize()).toString('hex');
  const { tx: result } = await balanceSealedTransaction(mergedTxHex);
  console.debug('[CESSteps] Wallet balanced and sealed transaction');

  console.debug('[CESSteps] Transaction processing complete');
  return deserializeTx(hexToBytes(result));
}
