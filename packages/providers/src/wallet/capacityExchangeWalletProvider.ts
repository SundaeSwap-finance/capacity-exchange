import type { WalletProvider } from '@midnight-ntwrk/midnight-js/types';
import type { BridgelessPayers } from './bridgelessPayer.js';
import type { CapacityExchangeConfig, ExchangePrice, Offer, PromptForCurrency, ConfirmOffer } from './types.js';
import { isOfferExpired } from './utils.js';
import { fetchCesPrices, requestCesOffer, processTransactionWithOffer } from './cesSteps.js';
import { bridgelessQuoteFromPrice } from './bridgelessPayer.js';
import {
  CapacityExchangeUserCancelledError,
  CapacityExchangeNoEligibleOfferError,
  CapacityExchangeOfferExpiredError,
  CapacityExchangeUnsupportedCurrencyError,
} from './errors.js';

async function selectCurrency(
  prices: ExchangePrice[],
  specksRequired: bigint,
  requestId: string,
  promptForCurrency: PromptForCurrency
): Promise<ExchangePrice> {
  console.debug('[CapacityExchange] Prompting user for currency selection');
  const result = await promptForCurrency(prices, specksRequired, requestId);

  if (result.status === 'cancelled') {
    throw new CapacityExchangeUserCancelledError();
  }

  if (result.status === 'no-eligible') {
    throw new CapacityExchangeNoEligibleOfferError();
  }

  console.debug(
    `[CapacityExchange] User selected exchange ${result.exchangePrice.exchangeApi.url}, currency:`,
    result.exchangePrice.price.currency
  );
  return result.exchangePrice;
}

async function confirmOfferWithUser(
  offer: Offer,
  specksRequired: bigint,
  requestId: string,
  confirmOffer: ConfirmOffer
): Promise<'confirmed' | 'back'> {
  console.debug('[CapacityExchange] Prompting user to confirm offer');
  const result = await confirmOffer(offer, specksRequired, requestId);

  if (result.status === 'cancelled') {
    throw new CapacityExchangeUserCancelledError();
  }

  if (result.status === 'back') {
    console.debug('[CapacityExchange] User went back to currency selection');
    return 'back';
  }

  console.debug('[CapacityExchange] User confirmed offer');

  if (isOfferExpired(offer.expiresAt)) {
    throw new CapacityExchangeOfferExpiredError(offer);
  }

  return 'confirmed';
}

/**
 * Creates a WalletProvider with Capacity Exchange functionality.
 *
 * The returned WalletProvider uses the provided identity keys and replaces
 * balanceTx with logic that acquires DUST through the Capacity Exchange server.
 */
/** The native currencies plus every foreign one a payer is registered for. */
function payableCurrencyTypes(payers: BridgelessPayers | undefined): ReadonlySet<string> {
  return new Set(['midnight:shielded', 'midnight:unshielded', ...Object.keys(payers ?? {})]);
}

export function capacityExchangeWalletProvider(config: CapacityExchangeConfig): WalletProvider {
  const {
    networkId,
    coinPublicKey,
    encryptionPublicKey,
    balanceUnsealedTransaction,
    balanceSealedTransaction,
    chainStateProvider,
    additionalCapacityExchangeUrls = [],
    margin = 3,
    promptForCurrency,
    confirmOffer,
    bridgelessPayers,
  } = config;

  return {
    getCoinPublicKey: () => coinPublicKey,
    getEncryptionPublicKey: () => encryptionPublicKey,

    async balanceTx(tx, _ttl?) {
      console.debug('[CapacityExchange] balanceTx called');

      const { prices, specksRequired } = await fetchCesPrices(tx, {
        networkId,
        chainStateProvider,
        additionalCapacityExchangeUrls,
        margin,
        payableCurrencyTypes: payableCurrencyTypes(bridgelessPayers),
      });

      while (true) {
        const requestId = crypto.randomUUID();
        const exchangePrice = await selectCurrency(prices, specksRequired, requestId, promptForCurrency);
        const currencyType = exchangePrice.price.currency.type;

        const payer = bridgelessPayers?.[currencyType];
        if (payer) {
          // Foreign-chain payment. Selecting the currency commits: the payer locks the escrow.
          return payer.pay(tx, bridgelessQuoteFromPrice(exchangePrice), specksRequired);
        }
        // TODO: replace these hardcoded native types with a parsed currency type plus a known-types
        // list in core, so foreign-vs-native is decided by a value, not a string compare.
        if (currencyType !== 'midnight:shielded' && currencyType !== 'midnight:unshielded') {
          throw new CapacityExchangeUnsupportedCurrencyError(currencyType);
        }

        const offer = await requestCesOffer(exchangePrice);
        const result = await confirmOfferWithUser(offer, specksRequired, requestId, confirmOffer);
        if (result === 'confirmed') {
          return processTransactionWithOffer(tx, offer, balanceUnsealedTransaction, balanceSealedTransaction);
        }
      }
    },
  };
}
