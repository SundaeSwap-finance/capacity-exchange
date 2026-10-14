/**
 * The offer protocol, after CIP-0198's HTTPS binding: the shape the client speaks to the
 * server's `/api/cardano/offers`, and the stand-in exchange reports in. CIP-0198 names the
 * states and rejection codes but not their wire spelling; kebab-case is ours.
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

import type { RejectionCode } from '@sundaeswap/capacity-exchange-cardano-tx';

export { OfferRejected, type RejectionCode } from '@sundaeswap/capacity-exchange-cardano-tx';

export interface Rejection {
  code: RejectionCode;
  message: string;
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
