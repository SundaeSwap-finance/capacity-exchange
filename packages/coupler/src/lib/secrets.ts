import * as crypto from 'crypto';
import { AppContext } from '@sundaeswap/capacity-exchange-nodejs';
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
  const s = crypto.randomBytes(32);
  const sPrime = crypto.randomBytes(32);
  return {
    s,
    sPrime,
    h: persistentHash(Bytes32Descriptor, s),
    hPrime: persistentHash(Bytes32Descriptor, sPrime),
  };
}

/** Store s' in the User's local witness store so mintReveal can consume it.
 *  Returns the private state id the coupling must use. */
export async function provisionSPrime(ctx: AppContext, sPrime: Uint8Array): Promise<string> {
  const privateStateId = crypto.randomBytes(32).toString('hex');
  await ctx.privateStateProvider.set(privateStateId, createPrivateState(sPrime));
  return privateStateId;
}
