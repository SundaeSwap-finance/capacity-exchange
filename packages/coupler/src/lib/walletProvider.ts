import * as crypto from 'crypto';
import type { WalletProvider } from '@midnight-ntwrk/midnight-js-types';
import { AppContext, createLogger } from '@sundaeswap/capacity-exchange-nodejs';
import { prepareUserFragment } from './userCoupling.js';
import type { CapacityProvider } from './capacity.js';
import type { CouplingRequest } from './couplingParams.js';

const logger = createLogger(import.meta);

/** Reveal ttl. Sized to outlast the capacity request round-trip, so the bound tx
 *  is still valid when the funded capacity returns. */
const REVEAL_TTL_MS = 10 * 60_000;

/** The one swap this provider couples. s' must already be provisioned in the
 *  private-state store under swapId (the dapp does this at escrow time). */
export interface SwapBinding {
  swapId: string;
  /** The disclosed gate. hash(s) must equal the escrow datum's h. */
  s: Uint8Array;
  /** hash(s'), sent to the LP. Must equal the escrow datum's h'. */
  hPrime: Uint8Array;
}

/** Handed back once the coupling is bound, so the dapp can update its swap record. */
export interface CouplingRecord {
  swapId: string;
  request: CouplingRequest;
}

export interface CouplerWalletProviderConfig {
  /** User side: proves the reveal and reads s' from its private-state store. */
  ctx: AppContext;
  couplerAddress: string;
  coinPublicKey: string;
  encryptionPublicKey: string;
  /** The LP-side capacity source. */
  capacity: CapacityProvider;
  /** One provider instance per swap. */
  swap: SwapBinding;
  /** Dust requested from the LP, in specks. */
  vFeeSpecks: bigint;
  /** Receives the coupling record once bound. The caller submits and confirms. */
  onCoupling?: (record: CouplingRecord) => void;
}

/**
 * A WalletProvider, bound to one swap, whose balanceTx acquires DUST by coupling
 * rather than from the wallet. It reveals the swap's already-committed secret (s
 * passed in, s' read from the store by swapId), has the LP fund the dust via the
 * capacity provider, and binds that capacity to the user's already-proven tx. It
 * never generates a secret, so it cannot break the escrow's hash(s) commitment.
 */
export function couplerWalletProvider(config: CouplerWalletProviderConfig): WalletProvider {
  const { ctx, couplerAddress, capacity, swap, vFeeSpecks } = config;

  if (swap.s.length !== 32) {
    throw new Error(`couplerWalletProvider: swap.s must be 32 bytes, got ${swap.s.length}`);
  }
  if (swap.hPrime.length !== 32) {
    throw new Error(`couplerWalletProvider: swap.hPrime must be 32 bytes, got ${swap.hPrime.length}`);
  }
  if (!swap.swapId) {
    throw new Error('couplerWalletProvider: swap.swapId must be non-empty');
  }

  return {
    getCoinPublicKey: () => config.coinPublicKey,
    getEncryptionPublicKey: () => config.encryptionPublicKey,

    async balanceTx(tx, ttl) {
      // tx is already proven. Prove only this swap's reveal, then bind. The witness
      // s' is read from the store by swapId, provisioned by the dapp at escrow time.
      const prepared = await prepareUserFragment(ctx, {
        couplerAddress,
        swapId: swap.swapId,
        s: swap.s,
        hPrime: swap.hPrime,
        nonce: crypto.randomBytes(32),
        vFeeSpecks,
        ttl: ttl ?? new Date(Date.now() + REVEAL_TTL_MS),
      });

      const funded = await capacity.requestCapacity(couplerAddress, prepared.request);

      logger.info('Binding LP capacity to the user tx...');
      const bound = funded.proven.merge(prepared.proven).merge(tx).bind();

      config.onCoupling?.({ swapId: swap.swapId, request: prepared.request });
      return bound;
    },
  };
}
