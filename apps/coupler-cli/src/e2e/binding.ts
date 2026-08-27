import * as crypto from 'crypto';
import { createLogger, AppContext } from '@sundaeswap/capacity-exchange-nodejs';
import { inMemoryPrivateStateProvider } from '@sundaeswap/capacity-exchange-core';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import {
  generateSwapSecrets,
  writeSPrimeWitness,
  prepareUserFragment,
  type CouplerContext,
} from '@sundaeswap/capacity-exchange-coupler/operations';
import { localCapacityProvider } from '../local/lp.js';
import { COUPLER_OUT_DIR } from '../chain/contract.js';
import { couplerContextFromAppContext } from '../coupling/prepare.js';
import { assertFundsThisSwap } from '@sundaeswap/capacity-exchange-coupler/operations';

const logger = createLogger(import.meta);

export const VFEE_SPECKS = 1n;
export const USER_TTL_MS = 10 * 60_000;

function couplerContext(ctx: AppContext): CouplerContext {
  return couplerContextFromAppContext(ctx, new NodeZkConfigProvider(COUPLER_OUT_DIR), logger);
}

/** Negative test: a capacity built with the WRONG h' must not compose with a matching
 *  reveal, so the merged tx fails to bind. */
export async function checkBinding(
  ctx: AppContext,
  userApp: AppContext,
  couplerAddress: string
): Promise<{ bindingHolds: boolean; wrongHPrimeError: string }> {
  logger.info("--- Binding check (wrong h', must fail) ---");
  try {
    const secrets = generateSwapSecrets();
    const privateStateProvider = inMemoryPrivateStateProvider();
    const swapId = crypto.randomBytes(32).toString('hex');
    await writeSPrimeWitness(privateStateProvider, couplerAddress, swapId, secrets.sPrime);
    const context = couplerContext(userApp);
    // One fee basis, same as the real path: couple() resolves it once and threads it down.
    const ledgerParameters = await context.getLedgerParameters();
    const prepared = await prepareUserFragment(context, {
      ledgerParameters,
      couplerAddress,
      swapId,
      s: secrets.s,
      hPrime: secrets.hPrime,
      nonce: crypto.randomBytes(32),
      vFeeSpecks: VFEE_SPECKS,
      ttl: new Date(Date.now() + USER_TTL_MS),
      privateStateProvider,
    });
    const wrongCapacity = await localCapacityProvider(ctx).requestCapacity(couplerAddress, {
      ...prepared.request,
      hPrime: crypto.randomBytes(32),
    });
    // The capacity funds a different hPrime, so it does not fund this swap. Reject it
    // locally rather than merging and letting the node say no, which on the real path
    // happens after the escrow has already committed foreign funds.
    assertFundsThisSwap(wrongCapacity, prepared.request);
    return { bindingHolds: false, wrongHPrimeError: 'a mismatched capacity was accepted' };
  } catch (e) {
    // Only a commitment mismatch counts. Any other throw, a proof server outage or a
    // dust selection failure, would otherwise be reported as the property holding.
    const message = ((e as Error).message ?? String(e)).slice(0, 160);
    return { bindingHolds: /commitment mismatch/.test(message), wrongHPrimeError: message };
  }
}
