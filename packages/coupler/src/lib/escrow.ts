import type { BridgelessQuote } from '@sundaeswap/capacity-exchange-providers';

/** An opaque, chain-defined handle to a locked escrow, passed from `lock` to the capacity call. */
export type EscrowRef = unknown;

export interface EscrowLockParams {
  /** The user-owned hashlock, hash(s), also the idempotency key. */
  h: Uint8Array;
  /** hash(s'), the anti-front-run commitment. */
  hPrime: Uint8Array;
  /** The signed quote being paid. */
  quote: BridgelessQuote;
}

/** Locks a foreign-chain asset against a hashlock for one swap. `lock` is idempotent on `h`: a
 *  second lock for the same `h` returns the existing escrow. */
export interface EscrowLocker {
  lock(params: EscrowLockParams): Promise<EscrowRef>;
}
