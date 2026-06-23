import { uint8ArrayToHex } from '@sundaeswap/capacity-exchange-core';
import type { LedgerParameters } from '@midnight-ntwrk/ledger-v8';
import type { CapacityFragment } from './capacity.js';
import type { CouplingRequest } from './couplingParams.js';

/** Just enough of a bound transaction to price it. Keeps the fee rule testable without
 *  standing up a WASM transaction. */
export interface Priceable {
  fees(params: LedgerParameters): bigint;
}

/** The LP's fragment is counterparty-controlled, so nothing it claims is trusted. A fragment
 *  funded for a different swap merges and binds perfectly well, and the mismatch would
 *  surface only when the node rejects it, which is after the escrow has already committed
 *  real foreign funds. Reject it while a throw still costs nothing. */
export function assertFundsThisSwap(funded: CapacityFragment, request: CouplingRequest): void {
  const differs = (got: Uint8Array, want: Uint8Array): boolean => uint8ArrayToHex(got) !== uint8ArrayToHex(want);

  if (differs(funded.priced.hPrime, request.hPrime)) {
    throw new Error('coupler: capacity does not fund this swap, hPrime commitment mismatch');
  }
  if (differs(funded.priced.nonce, request.nonce)) {
    throw new Error('coupler: capacity does not fund this swap, nonce commitment mismatch');
  }
  if (funded.priced.vFeeSpecks < request.vFeeSpecks) {
    throw new Error(`coupler: capacity funds ${funded.priced.vFeeSpecks} specks, request needs ${request.vFeeSpecks}`);
  }
}

/** The dust was sized from the user tx alone, but what gets submitted is that tx merged with
 *  the reveal and absorb calls and an offer, which costs more. Catch the shortfall locally
 *  rather than at submit, which is past the point of no return. */
export function assertDustCoversFee(bound: Priceable, vFeeSpecks: bigint, ledgerParameters: LedgerParameters): void {
  const fee = bound.fees(ledgerParameters);
  if (fee > vFeeSpecks) {
    throw new Error(`coupler: bound tx fee ${fee} specks exceeds the ${vFeeSpecks} specks funded`);
  }
}
