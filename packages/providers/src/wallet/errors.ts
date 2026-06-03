import type { ExchangePrice, Offer } from './types';

/** Discriminator tags on `CapacityExchangeError` subclasses. */
export type CapacityExchangeErrorType =
  | 'user-cancelled'
  | 'no-eligible-offer'
  | 'offer-expired'
  | 'offer-mismatch'
  | 'offer-transaction-invalid'
  | 'no-prices-available'
  | 'server-error';

/** Base class for all Capacity Exchange errors. */
export class CapacityExchangeError extends Error {
  constructor(
    readonly type: CapacityExchangeErrorType,
    message: string
  ) {
    super(message);
    this.name = 'CapacityExchangeError';
    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/** Thrown when the user cancels the currency selection. */
export class CapacityExchangeUserCancelledError extends CapacityExchangeError {
  constructor() {
    super('user-cancelled', 'User cancelled capacity exchange');
    this.name = 'CapacityExchangeUserCancelledError';
  }
}

/** Thrown when the caller's policy rejects every offered price. */
export class CapacityExchangeNoEligibleOfferError extends CapacityExchangeError {
  constructor() {
    super('no-eligible-offer', 'No offered price met caller policy');
    this.name = 'CapacityExchangeNoEligibleOfferError';
  }
}

/** Thrown when an offer expires before the transaction can be completed. */
export class CapacityExchangeOfferExpiredError extends CapacityExchangeError {
  constructor(readonly offer: Offer) {
    super('offer-expired', `Offer ${offer.offerId} expired at ${offer.expiresAt}`);
    this.name = 'CapacityExchangeOfferExpiredError';
  }
}

/** Thrown when the offer amount or currency differs from the original quote. */
export class CapacityExchangeOfferMismatchError extends CapacityExchangeError {
  constructor(
    /** The `price` field is enough info for logging the original quote */
    readonly quotePrice: Pick<ExchangePrice, 'price'>,
    readonly offer: Offer
  ) {
    super(
      'offer-mismatch',
      `Offer ${offer.offerId} mismatch: quoted ${quotePrice.price.amount} ${quotePrice.price.currency.id}, ` +
        `but offer returned ${offer.offerAmount} ${offer.offerCurrency.id}`
    );
    this.name = 'CapacityExchangeOfferMismatchError';
  }
}

/** Thrown when the serialized transaction in an offer contains unexpected components. */
export class CapacityExchangeOfferTransactionInvalidError extends CapacityExchangeError {
  constructor(
    readonly offerId: string,
    reason: string
  ) {
    super('offer-transaction-invalid', `Offer ${offerId} contains an invalid transaction: ${reason}`);
    this.name = 'CapacityExchangeOfferTransactionInvalidError';
  }
}

/** Thrown when no prices are available from any capacity exchange. */
export class CapacityExchangeNoPricesAvailableError extends CapacityExchangeError {
  constructor() {
    super('no-prices-available', 'No prices available from any capacity exchange');
    this.name = 'CapacityExchangeNoPricesAvailableError';
  }
}

/** Thrown when the Capacity Exchange server returns an error. */
export class CapacityExchangeServerError extends CapacityExchangeError {
  constructor(
    readonly statusCode: number,
    message: string
  ) {
    super('server-error', `Capacity Exchange server error (${statusCode}): ${message}`);
    this.name = 'CapacityExchangeServerError';
  }
}

/**
 * Type guard to check if an error is a CapacityExchangeError.
 */
export function isCapacityExchangeError(e: unknown): e is CapacityExchangeError {
  return e instanceof CapacityExchangeError;
}
