import type { WalletProvider } from '@midnight-ntwrk/midnight-js-types';
import type { CapacityExchangeConfig, ExchangePrice, Offer, PromptForCurrency, ConfirmOffer } from './types';
import { isOfferExpired } from './utils';
import { fetchCesPrices, requestCesOffer, processTransactionWithOffer } from './cesSteps';
import { CapacityExchangeUserCancelledError, CapacityExchangeOfferExpiredError } from './errors';

async function selectCurrency(
  prices: ExchangePrice[],
  specksRequired: bigint,
  promptForCurrency: PromptForCurrency
): Promise<ExchangePrice> {
  console.debug('[CapacityExchange] Prompting user for currency selection');
  const result = await promptForCurrency(prices, specksRequired);

  if (result.status === 'cancelled') {
    throw new CapacityExchangeUserCancelledError();
  }

  console.debug('[CapacityExchange] User selected currency:', result.exchangePrice.price.currency);
  return result.exchangePrice;
}

async function confirmOfferWithUser(
  offer: Offer,
  specksRequired: bigint,
  confirmOffer: ConfirmOffer
): Promise<'confirmed' | 'back'> {
  console.debug('[CapacityExchange] Prompting user to confirm offer');
  const result = await confirmOffer(offer, specksRequired);

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
export function capacityExchangeWalletProvider(config: CapacityExchangeConfig): WalletProvider {
  const {
    coinPublicKey,
    encryptionPublicKey,
    balanceSealedTx,
    capacityExchangeUrls,
    indexerUrl,
    margin,
    promptForCurrency,
    confirmOffer,
  } = config;

  return {
    getCoinPublicKey: () => coinPublicKey,
    getEncryptionPublicKey: () => encryptionPublicKey,

    async balanceTx(tx, _ttl?) {
      console.debug('[CapacityExchange] balanceTx called');

      const { prices, specksRequired } = await fetchCesPrices(tx, indexerUrl, capacityExchangeUrls, margin);

      while (true) {
        const exchangePrice = await selectCurrency(prices, specksRequired, promptForCurrency);
        const offer = await requestCesOffer(exchangePrice);
        const result = await confirmOfferWithUser(offer, specksRequired, confirmOffer);

        if (result === 'confirmed') {
          return processTransactionWithOffer(tx, offer, balanceSealedTx);
        }
      }
    },
  };
}
