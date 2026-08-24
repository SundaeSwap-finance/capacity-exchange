import { randomBytes } from './random.js';
import type { PrivateStateProvider } from '@midnight-ntwrk/midnight-js/types';
import { persistentHash, Bytes32Descriptor } from '@midnight-ntwrk/compact-runtime';
import { createPrivateState } from './witnesses.js';

/** The User's per-swap secrets and their commitments (h, h'). */
export interface SwapSecrets {
  /** Public gate, revealed at coupling time. The escrow checks hash(s) == commitment.h. */
  s: Uint8Array;
  /** Anti-front-run witness, never revealed. Only hash(s') surfaces. */
  sPrime: Uint8Array;
  h: Uint8Array;
  hPrime: Uint8Array;
}

/** Generate the User's two secrets for one swap, at quote time. */
export function generateSwapSecrets(): SwapSecrets {
  const s = randomBytes(32);
  const sPrime = randomBytes(32);
  return {
    s,
    sPrime,
    h: persistentHash(Bytes32Descriptor, s),
    hPrime: persistentHash(Bytes32Descriptor, sPrime),
  };
}

/** Store s' in a witness store (keyed by swapId) so mintReveal can read it. setContractAddress
 *  is required, the provider scopes keys by contract address. The bridgeless payment method passes
 *  a fresh in-memory provider per call (ephemeral s'). A dapp may pass a durable one. */
export async function writeSPrimeWitness(
  privateStateProvider: PrivateStateProvider,
  couplerAddress: string,
  swapId: string,
  sPrime: Uint8Array
): Promise<void> {
  privateStateProvider.setContractAddress(couplerAddress);
  await privateStateProvider.set(swapId, createPrivateState(sPrime));
}
