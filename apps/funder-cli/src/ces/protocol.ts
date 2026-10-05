/**
 * The offer protocol, after CIP-0198's HTTPS binding. The server has no such route yet, so
 * this is the shape the real client speaks and the stand-in exchange reports in. CIP-0198
 * names the states and rejection codes but not their wire spelling; kebab-case is ours.
 */

/** Where the route will live. Offer routes are prefixed by the chain the capacity is for. */
export const OFFERS_PATH = '/api/cardano/offers';

/**
 * An offer's state at a service. The first five are the service's own view; the last three
 * are settled by the chain. None of them is authoritative about inclusion — CIP-0198 has the
 * publisher follow the chain for that.
 */
export type OfferState =
  'received' | 'verified' | 'included-in-batch' | 'submitted' | 'rejected' | 'confirmed' | 'expired' | 'invalidated';

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

/** `POST {OFFERS_PATH}`. CIP-0198 has a firm quote travel alongside the envelope. */
export interface SubmitOfferRequest {
  /** Hex of `[envelope_version, era_tag, #6.24(subtx_bytes)]`. */
  envelope: string;
  quoteId: string;
}

/** The `202` body. Acceptance is for verification, not a promise to batch. */
export interface SubmitOfferAccepted {
  offerId: string;
  state: OfferState;
}

/** `GET {OFFERS_PATH}/{offerId}`. */
export interface OfferStatus {
  offerId: string;
  state: OfferState;
  /** Present once the offer has gone into a submitted batch. */
  batchTxId?: string;
  /** Present when the state is `rejected`. */
  reason?: Rejection;
}

/**
 * States after which the caller stops asking the service. From `submitted` on, the chain is
 * the better source; before it, the service is the only one that knows anything.
 */
export function stopsPolling(state: OfferState): boolean {
  return ['submitted', 'rejected', 'confirmed', 'expired', 'invalidated'].includes(state);
}
