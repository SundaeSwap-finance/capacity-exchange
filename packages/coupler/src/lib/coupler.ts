import { randomBytes } from './random.js';
import type { UnboundTransaction, PrivateStateProvider } from '@midnight-ntwrk/midnight-js/types';
import type { FinalizedTransaction } from '@midnight-ntwrk/ledger-v8';
import { prepareUserFragment } from './userCoupling.js';
import type { CapacityProvider } from './capacity.js';
import type { CouplingRequest } from './couplingParams.js';
import type { CouplerContext } from './context.js';
import { assertFundsThisSwap, assertDustCoversFee } from './validateCapacity.js';

/** Reveal ttl when the caller gives none. Sized to outlast the capacity round-trip. */
const REVEAL_TTL_MS = 10 * 60_000;

/** The secret and commitments of one swap. s' must already be in the user's private-state
 *  store under swapId, which the dapp provisions at escrow time. */
export interface SwapBinding {
  swapId: string;
  /** The disclosed gate. hash(s) must equal the escrow datum's h. */
  s: Uint8Array;
  /** hash(s'), sent to the LP. Must equal the escrow datum's h'. */
  hPrime: Uint8Array;
}

/** The inputs of one couple call. */
export interface CouplerParams {
  swap: SwapBinding;
  capacity: CapacityProvider;
  privateStateProvider: PrivateStateProvider;
  /** Dust the LP funds for this op, in specks. */
  vFeeSpecks: bigint;
  /** ttl for the user's reveal intent. */
  ttl?: Date;
}

export interface CoupleResult {
  /** Bound, ready to submit. */
  bound: FinalizedTransaction;
  /** The terms sent to the LP, for the dapp's swap record. */
  request: CouplingRequest;
  swapId: string;
}

export interface Coupler {
  /** Couple a proven, unbalanced user tx (no wallet balanceTx, so the LP funds the dust):
   *  reveal s, have the LP fund the dust, then merge and bind. Returns the bound tx, the
   *  caller submits. It never generates a secret, so it cannot break the escrow's hash(s)
   *  commitment. */
  couple(userTx: UnboundTransaction, params: CouplerParams): Promise<CoupleResult>;
}

export function createCoupler(context: CouplerContext, couplerAddress: string): Coupler {
  return {
    async couple(userTx, params) {
      const { swap, capacity, privateStateProvider, vFeeSpecks, ttl } = params;
      if (swap.s.length !== 32) {
        throw new Error(`coupler: swap.s must be 32 bytes, got ${swap.s.length}`);
      }
      if (swap.hPrime.length !== 32) {
        throw new Error(`coupler: swap.hPrime must be 32 bytes, got ${swap.hPrime.length}`);
      }
      if (!swap.swapId) {
        throw new Error('coupler: swap.swapId must be non-empty');
      }
      if (vFeeSpecks <= 0n) {
        throw new Error(`coupler: vFeeSpecks must be positive, got ${vFeeSpecks}`);
      }

      // One fee basis for the whole coupling. Fetching separately in each step would let the
      // reveal fragment and the bound tx be priced against different parameters.
      const ledgerParameters = await context.getLedgerParameters();
      const prepared = await prepareUserFragment(context, {
        ledgerParameters,
        couplerAddress,
        swapId: swap.swapId,
        s: swap.s,
        hPrime: swap.hPrime,
        nonce: randomBytes(32),
        vFeeSpecks,
        ttl: ttl ?? new Date(Date.now() + REVEAL_TTL_MS),
        privateStateProvider,
      });

      // One fee basis for the whole coupling. Fetching it again below would let the
      // dust budget and the bound tx be priced against different parameters.
      const funded = await capacity.requestCapacity(couplerAddress, prepared.request);
      assertFundsThisSwap(funded, prepared.request);

      context.logger.info('Binding LP capacity to the user tx...');
      const bound = funded.proven.merge(prepared.proven).merge(userTx).bind();
      assertDustCoversFee(bound, prepared.request.vFeeSpecks, ledgerParameters);

      return { bound, request: prepared.request, swapId: swap.swapId };
    },
  };
}
