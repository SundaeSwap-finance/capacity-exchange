/**
 * The offer protocol, after CIP-0198's HTTPS binding, as the server speaks it. CIP-0198 names
 * the states and rejection codes but not their wire spelling; kebab-case is the server's.
 */

/** Signed price hints, a JSON array of hex CBOR. Routes are prefixed by the chain the capacity is for. */
export const HINTS_PATH = '/api/cardano/hints';

/** Takes the raw envelope as `application/cbor`. */
export const OFFERS_PATH = '/api/cardano/offers';

/**
 * What the exchange said about an offer, in CIP-0198's terms. The server answers only once it
 * has submitted the batch or refused, so these are the only two a caller sees. Neither is
 * authoritative about inclusion — CIP-0198 has the publisher follow the chain for that.
 */
export type OfferState = 'submitted' | 'rejected';

/** CIP-0198's closed set of refusal reasons. */
export type RejectionCode =
  | 'malformed'
  | 'unsupported-version'
  | 'not-interested'
  | 'over-budget'
  | 'duplicate'
  | 'settled'
  | 'expired'
  | 'invalidated'
  | 'superseded'
  | 'busy'
  | 'not-ready';

export interface Rejection {
  code: RejectionCode;
  message: string;
}

export class OfferRejected extends Error {
  constructor(
    readonly code: RejectionCode,
    message: string
  ) {
    super(`${code}: ${message}`);
  }
}

/**
 * The `202` body. The server has built and submitted the batch by the time it answers, but
 * does not say which batch, and has no route to ask about an offer afterwards.
 */
export interface SubmitOfferAccepted {
  offerId: string;
}
