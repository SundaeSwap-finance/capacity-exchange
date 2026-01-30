import type { ApiOffersPost201Response } from '@capacity-exchange/client';
import type {
  Offer,
  PromptForCurrency,
  ConfirmOffer,
  SelectAndConfirmOfferResult,
  ExchangePrice,
} from './types';
import { isOfferExpired } from './utils';

export function convertToOffer(offerResponse: ApiOffersPost201Response): Offer {
  return {
    offerId: offerResponse.offerId,
    offerAmount: offerResponse.offerAmount,
    offerCurrency: offerResponse.offerCurrency,
    serializedTx: offerResponse.serializedTx,
    expiresAt: offerResponse.expiresAt,
  };
}

/**
 * Handles the user flow for selecting a currency and confirming an offer.
 * Loops until user confirms an offer or returns a terminal state.
 * Returns a result indicating success or the specific failure case.
 */
export async function selectAndConfirmOffer(
  exchangePrices: ExchangePrice[],
  dustRequired: bigint,
  promptForCurrency: PromptForCurrency,
  confirmOffer: ConfirmOffer
): Promise<SelectAndConfirmOfferResult> {
  while (true) {
    console.debug('[CapacityExchange] Prompting user for currency selection');
    const currencyResult = await promptForCurrency(exchangePrices, dustRequired);

    if (currencyResult.status === 'cancelled') {
      console.debug('[CapacityExchange] User cancelled currency selection');
      return { status: 'userCancelled' };
    }

    const { exchangePrice } = currencyResult;
    console.debug('[CapacityExchange] User selected currency:', exchangePrice.price.currency);

    // Request offer from the selected exchange
    console.debug(
      '[CapacityExchange] Requesting offer from exchange:',
      exchangePrice.exchangeApi.url
    );
    const offerResponse = await exchangePrice.exchangeApi.api.apiOffersPost({
      apiOffersPostRequest: {
        requestAmount: dustRequired.toString(),
        offerCurrency: exchangePrice.price.currency,
      },
    });
    console.debug('[CapacityExchange] Offer received:', offerResponse);

    const offer = convertToOffer(offerResponse);

    if (isOfferExpired(offer.expiresAt)) {
      console.debug('[CapacityExchange] Offer already expired');
      return { status: 'offerExpired', offer };
    }

    // Confirm offer with user
    console.debug('[CapacityExchange] Prompting user to confirm offer');
    const confirmResult = await confirmOffer(offer, dustRequired);

    if (confirmResult.status === 'cancelled') {
      console.debug('[CapacityExchange] User cancelled');
      return { status: 'userCancelled' };
    }

    if (confirmResult.status === 'back') {
      console.debug('[CapacityExchange] User went back to currency selection');
      continue;
    }

    console.debug('[CapacityExchange] User confirmed offer');

    if (isOfferExpired(offer.expiresAt)) {
      console.debug('[CapacityExchange] Offer expired during confirmation');
      return { status: 'offerExpired', offer };
    }

    return { status: 'success', offer };
  }
}
