import { firstValueFrom } from 'rxjs';
import { AppContext, createLogger } from '@sundaeswap/capacity-exchange-nodejs';
import {
  getLatestBlockTimestamp,
  getLedgerParameters,
  buildFragmentTx,
  type DustAttachment,
} from '@sundaeswap/capacity-exchange-core';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import type { UnboundTransaction } from '@midnight-ntwrk/midnight-js-types';
import { COUPLER_OUT_DIR } from './contract.js';
import { createDustSpend } from './dust.js';
import { buildAbsorbLeg } from './couplerLegs.js';
import type { CouplingRequest, PricedCoupling } from './couplingParams.js';

const logger = createLogger(import.meta);

/** How long the LP's dust stays committed. Covers this fragment's capacity proof,
 *  submit, and inclusion, with margin over the observed expiry floor. */
const COUPLING_TTL_MS = 5 * 60_000;

export interface CapacityFragment {
  proven: UnboundTransaction;
  /** The LP's fixed terms, the inputs this capacity fragment is built from. */
  priced: PricedCoupling;
}

/**
 * LP side. Fix the LP-owned terms (ttl, chain params) over the request, then build
 * and prove the capacity fragment: absorb and the supplied dust payment, sealed in
 * one intent so the dust can't be lifted onto another tx. The dust spend is passed
 * in, not selected here, so the caller that owns the dust UTXOs and their in-use
 * tracking decides which to spend. The LP never sees the user's tx.
 */
export async function buildCapacityFragment(
  ctx: AppContext,
  couplerAddress: string,
  request: CouplingRequest,
  dust: DustAttachment
): Promise<CapacityFragment> {
  const ledgerParameters = await getLedgerParameters(ctx.config.network.endpoints.indexerHttpUrl);
  const priced: PricedCoupling = {
    ...request,
    ttl: new Date(Date.now() + COUPLING_TTL_MS),
    ledgerParameters,
  };

  const absorbLeg = await buildAbsorbLeg(ctx, couplerAddress, priced.h, priced.hPrime, priced.nonce);

  const fragment = buildFragmentTx([absorbLeg], priced.ttl, ledgerParameters, { dust });
  logger.info(`Proving capacity fragment (absorb and ${priced.vFeeSpecks} specks dust)...`);
  const proofProvider = httpClientProofProvider(
    ctx.config.network.endpoints.proofServerUrl,
    new NodeZkConfigProvider<string>(COUPLER_OUT_DIR)
  );
  const proven = await proofProvider.proveTx(fragment);
  return { proven, priced };
}

/** The LP-side capacity source. The user side depends on this alone, not on how
 *  the capacity is produced. */
export interface CapacityProvider {
  requestCapacity(couplerAddress: string, request: CouplingRequest): Promise<CapacityFragment>;
}

/** Local LP: selects a dust UTXO in this process, with no in-use tracking, then
 *  builds the fragment. A server provider selects dust against its own usage
 *  tracking instead. Swap for a CES-server impl without touching the user side. */
export function localCapacityProvider(ctx: AppContext): CapacityProvider {
  return {
    requestCapacity: async (couplerAddress, request) => {
      const ctime = await getLatestBlockTimestamp(ctx.config.network.endpoints.indexerHttpUrl);
      const dustState = (await firstValueFrom(ctx.walletContext.walletFacade.state())).dust;
      const spend = createDustSpend(dustState, ctx.walletContext.keys.dustSecretKey, request.vFeeSpecks, ctime);
      return buildCapacityFragment(ctx, couplerAddress, request, { spend, ctime });
    },
  };
}
