import * as crypto from 'crypto';
import type { UnboundTransaction } from '@midnight-ntwrk/midnight-js-types';
import type { FinalizedTransaction } from '@midnight-ntwrk/ledger-v8';
import { prepareUserFragment } from './userCoupling.js';
import type { CapacityProvider } from './capacity.js';
import type { CouplingRequest } from './couplingParams.js';
import type { CouplingEnv } from './env.js';

/** Reveal ttl when the caller gives none. Sized to outlast the capacity round-trip. */
const REVEAL_TTL_MS = 10 * 60_000;

/** The secret and commitments of one swap. Passed per couple call, so one coupler
 *  serves many swaps. s' must already be in the user's private-state store under swapId
 *  (the dapp provisions it at escrow time). */
export interface SwapBinding {
  swapId: string;
  /** The disclosed gate. hash(s) must equal the escrow datum's h. */
  s: Uint8Array;
  /** hash(s'), sent to the LP. Must equal the escrow datum's h'. */
  hPrime: Uint8Array;
}

export interface CoupleOpts {
  /** Overrides the coupler's default dust, in specks. */
  vFeeSpecks?: bigint;
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

export interface CouplerConfig {
  env: CouplingEnv;
  couplerAddress: string;
  capacity: CapacityProvider;
  /** Default dust the LP funds, in specks. Overridable per couple call. */
  vFeeSpecks: bigint;
}

export interface Coupler {
  /** Couple a proven, unbalanced user tx (no wallet balanceTx, so the LP funds the dust):
   *  reveal s, have the LP fund the dust, then merge and bind. Returns the bound tx, the
   *  caller submits. It never generates a secret, so it cannot break the escrow's hash(s)
   *  commitment. */
  couple(userTx: UnboundTransaction, swap: SwapBinding, opts?: CoupleOpts): Promise<CoupleResult>;
}

export function createCoupler(config: CouplerConfig): Coupler {
  const { env, couplerAddress, capacity } = config;
  if (config.vFeeSpecks <= 0n) {
    throw new Error(`coupler: vFeeSpecks must be positive, got ${config.vFeeSpecks}`);
  }

  return {
    async couple(userTx, swap, opts) {
      if (swap.s.length !== 32) {
        throw new Error(`coupler: swap.s must be 32 bytes, got ${swap.s.length}`);
      }
      if (swap.hPrime.length !== 32) {
        throw new Error(`coupler: swap.hPrime must be 32 bytes, got ${swap.hPrime.length}`);
      }
      if (!swap.swapId) {
        throw new Error('coupler: swap.swapId must be non-empty');
      }
      const vFeeSpecks = opts?.vFeeSpecks ?? config.vFeeSpecks;
      if (vFeeSpecks <= 0n) {
        throw new Error(`coupler: vFeeSpecks must be positive, got ${vFeeSpecks}`);
      }

      // Prove only this swap's reveal, then bind. The witness s' is read from the store
      // by swapId, provisioned by the dapp at escrow time.
      const prepared = await prepareUserFragment(env, {
        couplerAddress,
        swapId: swap.swapId,
        s: swap.s,
        hPrime: swap.hPrime,
        nonce: crypto.randomBytes(32),
        vFeeSpecks,
        ttl: opts?.ttl ?? new Date(Date.now() + REVEAL_TTL_MS),
      });

      const funded = await capacity.requestCapacity(couplerAddress, prepared.request);

      env.logger.info('Binding LP capacity to the user tx...');
      const bound = funded.proven.merge(prepared.proven).merge(userTx).bind();

      return { bound, request: prepared.request, swapId: swap.swapId };
    },
  };
}
