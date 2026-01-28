import type { Offer } from './types';

/**
 * Base class for all Capacity Exchange errors.
 */
export class CapacityExchangeError extends Error {
  readonly type: string = 'capacity-exchange-error';

  constructor(message: string) {
    super(message);
    this.name = 'CapacityExchangeError';
    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Thrown when the user cancels the currency selection.
 */
export class CapacityExchangeUserCancelledError extends CapacityExchangeError {
  readonly type = 'user-cancelled' as const;

  constructor() {
    super('User cancelled capacity exchange');
    this.name = 'CapacityExchangeUserCancelledError';
  }
}

/**
 * Thrown when an offer expires before the transaction can be completed.
 */
export class CapacityExchangeOfferExpiredError extends CapacityExchangeError {
  readonly type = 'offer-expired' as const;

  constructor(readonly offer: Offer) {
    super(`Offer ${offer.offerId} expired at ${offer.expiresAt}`);
    this.name = 'CapacityExchangeOfferExpiredError';
  }
}

/**
 * Thrown when the Capacity Exchange server returns an error.
 */
export class CapacityExchangeServerError extends CapacityExchangeError {
  readonly type = 'server-error' as const;

  constructor(
    readonly statusCode: number,
    message: string
  ) {
    super(`Capacity Exchange server error (${statusCode}): ${message}`);
    this.name = 'CapacityExchangeServerError';
  }
}

/**
 * Type guard to check if an error is a CapacityExchangeError.
 */
export function isCapacityExchangeError(e: unknown): e is CapacityExchangeError {
  return e instanceof CapacityExchangeError;
}
