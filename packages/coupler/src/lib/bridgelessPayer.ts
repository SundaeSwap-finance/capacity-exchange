import { randomHex } from './random.js';
import type { BridgelessPayer, BridgelessQuote } from '@sundaeswap/capacity-exchange-providers';
import type { PrivateStateProvider } from '@midnight-ntwrk/midnight-js/types';
import type { CouplerContext } from './context.js';
import type { CapacityProvider, ForeignCapacity } from './capacity.js';
import type { EscrowLocker } from './escrow.js';
import { createCoupler } from './coupler.js';
import { generateSwapSecrets, writeSPrimeWitness } from './secrets.js';

export interface BridgelessPayerConfig {
  context: CouplerContext;
  couplerAddress: string;
  /** Locks the foreign asset against the hashlock. */
  escrow: EscrowLocker;
  /** Acquires LP dust for the escrowed swap. */
  capacity: ForeignCapacity;
  /** Where s' is written, keyed per swap. Must outlive this call: pay() returns a tx the
   *  caller submits, and a failed submit needs s' again to rebuild the reveal leg. */
  privateStateProvider: PrivateStateProvider;
}

/** Build a bridgeless payer for one foreign chain. Each pay call originates one swap: fresh
 *  ephemeral secrets, create the escrow (idempotent on h), acquire LP capacity for that escrow,
 *  couple, return the bound tx. s' is written to the caller's private state store keyed by swapId,
 *  so it survives the call. `dustSpecks` is the dust the user op needs, the amount the quote was
 *  priced on. */
export function createBridgelessPayer(config: BridgelessPayerConfig): BridgelessPayer {
  const { context, couplerAddress, escrow, capacity, privateStateProvider } = config;
  const coupler = createCoupler(context, couplerAddress);
  return {
    async pay(userTx, quote: BridgelessQuote, dustSpecks: bigint) {
      const secrets = generateSwapSecrets();
      const swapId = randomHex(32);

      // s' is keyed by swapId in the caller's store, so it outlives this call and a failed
      // submit can rebuild the reveal leg rather than forcing a refund.
      await writeSPrimeWitness(privateStateProvider, couplerAddress, swapId, secrets.sPrime);

      // Lock the foreign escrow gated on the hashlock, idempotent on h (user-owned key).
      const escrowRef = await escrow.lock({ h: secrets.h, hPrime: secrets.hPrime, quote });

      // The coupler asks for capacity by (couplerAddress, request). Bind this swap's escrow and
      // quote into that call.
      const escrowCapacity: CapacityProvider = {
        requestCapacity: (addr, request) => capacity.requestCapacity(addr, request, escrowRef, quote),
      };

      const { bound } = await coupler.couple(userTx, {
        swap: { swapId, s: secrets.s, hPrime: secrets.hPrime },
        capacity: escrowCapacity,
        privateStateProvider,
        vFeeSpecks: dustSpecks,
      });
      return bound;
    },
  };
}
