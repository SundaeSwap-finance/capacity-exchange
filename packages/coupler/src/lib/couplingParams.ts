import type { LedgerParameters } from '@midnight-ntwrk/ledger-v8';

/** The deal terms the user asks the LP to fund. */
export interface CouplingRequest {
  /** Public hash of s. */
  h: Uint8Array;
  /** Public hash of s'. */
  hPrime: Uint8Array;
  /** Coin-pairing tag shared by the reveal mint and the absorb spend, so both must
   *  carry the same value to pair. Caller-supplied, so assembly needs no round-trip. */
  nonce: Uint8Array;
  /** Dust the LP commits, in specks. Consumed entirely. */
  vFeeSpecks: bigint;
}

/** The request extended with the ttl and chain-params snapshot this fragment is
 *  priced and built against. */
export interface PricedCoupling extends CouplingRequest {
  ttl: Date;
  ledgerParameters: LedgerParameters;
}
