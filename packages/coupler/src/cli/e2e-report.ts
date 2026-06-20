import { firstValueFrom } from 'rxjs';
import { AppContext } from '@sundaeswap/capacity-exchange-nodejs';
import { uint8ArrayToHex } from '@sundaeswap/capacity-exchange-core';
import { type VerifyOutput } from '../lib/operations.js';
import { type CircuitPrivateState } from '../lib/witnesses.js';
import { type Coupling } from './e2e-flows.js';

/** A wallet's dust at a fixed instant, so continuous regeneration cancels between reads. */
export async function dustBalanceAt(app: AppContext, at: Date): Promise<bigint> {
  return (await firstValueFrom(app.walletContext.walletFacade.state())).dust.balance(at);
}

/** Per-coupling result: on-chain status, and whether the txId-keyed read recovers the
 *  swap's own s and hsp. */
export function couplingResult(c: Coupling, v: VerifyOutput) {
  return {
    couple: { txHash: c.txHash, status: c.status },
    verify: v,
    sMatches: v.lastS === uint8ArrayToHex(c.secrets.s),
    hspMatches: v.lastHsp === uint8ArrayToHex(c.secrets.hPrime),
  };
}

/** Whether the store kept this swap's s' under its swapId. */
export function sPrimeRetained(ps: CircuitPrivateState | null, sPrime: Uint8Array): boolean {
  return ps != null && uint8ArrayToHex(ps.sPrime) === uint8ArrayToHex(sPrime);
}
