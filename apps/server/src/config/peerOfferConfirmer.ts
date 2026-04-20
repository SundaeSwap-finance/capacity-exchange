import type { FastifyBaseLogger } from 'fastify';
import type { ConfirmOffer } from '@sundaeswap/capacity-exchange-providers';

/** Creates a {@link ConfirmOffer} that accepts every offer and logs it. */
export function createAutoConfirmOffer(log: FastifyBaseLogger): ConfirmOffer {
  return async (offer, dustRequired) => {
    log.info(
      {
        offerId: offer.offerId,
        amount: offer.offerAmount,
        currency: offer.offerCurrency,
        dustRequired: dustRequired.toString(),
      },
      'Auto-confirming offer',
    );
    return { status: 'confirmed' };
  };
}
