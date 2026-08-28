import * as crypto from 'crypto';
import { AppContext } from '@sundaeswap/capacity-exchange-nodejs';
import { uint8ArrayToHex } from '@sundaeswap/capacity-exchange-core';
import { type CesApiResolver, type CesApi } from '@sundaeswap/capacity-exchange-providers/testing';
import {
  type CapacityFragment,
  type EscrowLocker,
  type EscrowLockParams,
  type EscrowRef,
  type ForeignCapacity,
} from '@sundaeswap/capacity-exchange-coupler/operations';
import { localCapacityProvider } from './lp.js';
import { CARDANO } from '../coupling/prepare.js';
import type { CouplingCommitment } from '../coupling/commitments.js';

const QUOTED_LOVELACE = '1000000';

/** The escrow ref the stub locker hands back: just the hashlock, so the stub LP can check the
 *  request against the escrow it is funding. */
interface StubEscrowRef {
  h: Uint8Array;
}

/** A fake cap-ex exchange quoting ADA. The only thing the e2e fakes: it feeds a `cardano:` price
 *  through the real balanceTx selection path so the bridgeless payer runs. */
export function fakeCardanoResolver(): CesApiResolver {
  const api = {
    apiPricesGet: async () => ({
      quoteId: crypto.randomUUID(),
      prices: [{ amount: QUOTED_LOVELACE, currency: { id: 'ada', type: CARDANO, rawId: '' } }],
    }),
  } as unknown as CesApi['api'];
  const cesApi: CesApi = { url: 'fake://cardano-exchange', api };
  return async () => [cesApi];
}

/** In-memory escrow, idempotent on h: a second lock for the same h returns the first ref. */
export function inMemoryEscrowLocker(): EscrowLocker {
  const byH = new Map<string, EscrowRef>();
  return {
    lock: async (params: EscrowLockParams): Promise<EscrowRef> => {
      const key = uint8ArrayToHex(params.h);
      const existing = byH.get(key);
      if (existing) {
        return existing;
      }
      const ref: EscrowRef = { h: params.h } satisfies StubEscrowRef;
      byH.set(key, ref);
      return ref;
    },
  };
}

/** A ForeignCapacity that also reports the dust it spent, for the harness's own assertions. */
export interface EscrowCheckingCapacity extends ForeignCapacity {
  usedDustUtxos(): string[];
  /** The (h, h') of every coupling this LP actually funded, which is what it would hold in its
   *  own escrow index. A disclosure read is resolved against these, never against position. */
  fundedCommitments(): CouplingCommitment[];
}

/** Stub LP capacity: the LP funds dust only for the escrow it can verify. It checks the request's
 *  h against the escrow ref (trusting the escrow, not the caller's claim), then builds the real
 *  dust fragment via the in-process LP. */
export function escrowCheckingCapacity(ctx: AppContext): EscrowCheckingCapacity {
  const local = localCapacityProvider(ctx);
  const funded: CouplingCommitment[] = [];
  return {
    usedDustUtxos: () => local.usedDustUtxos(),
    fundedCommitments: () => [...funded],
    requestCapacity: async (couplerAddress, request, escrowRef, _quote): Promise<CapacityFragment> => {
      const escrowH = (escrowRef as StubEscrowRef).h;
      if (uint8ArrayToHex(escrowH) !== uint8ArrayToHex(request.h)) {
        throw new Error('capacity: request.h does not match the locked escrow');
      }
      funded.push({ h: request.h, hPrime: request.hPrime });
      return local.requestCapacity(couplerAddress, request);
    },
  };
}
