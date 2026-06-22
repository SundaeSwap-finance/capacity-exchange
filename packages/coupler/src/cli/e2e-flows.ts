import * as crypto from 'crypto';
import { createLogger, AppContext } from '@sundaeswap/capacity-exchange-nodejs';
import { inMemoryPrivateStateProvider } from '@sundaeswap/capacity-exchange-core';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import {
  generateSwapSecrets,
  provisionSPrime,
  prepareUserFragment,
  finalizeCoupling,
  localCapacityProvider,
  createCoupler,
  couplingEnvFromAppContext,
  type SwapSecrets,
  type CouplingEnv,
} from '../lib/operations.js';
import { COUPLER_OUT_DIR } from '../lib/contract.js';
import { buildCounterIncrementTx } from '../lib/counter.js';

const logger = createLogger(import.meta);

export const VFEE_SPECKS = 1n;
export const USER_TTL_MS = 10 * 60_000;

/** The nodejs CouplingEnv for the coupler contract: an AppContext, filesystem zk keys,
 *  and this harness's logger. */
function couplerEnv(ctx: AppContext): CouplingEnv {
  return couplingEnvFromAppContext(ctx, new NodeZkConfigProvider(COUPLER_OUT_DIR), logger);
}

export interface Coupling {
  swapId: string;
  secrets: SwapSecrets;
  txHash: string;
  status: string;
}

export interface CoupleDeps {
  ctx: AppContext;
  userCtx: AppContext;
  couplerAddress: string;
  counterAddress: string;
}

/** One swap as a dapp would run it: generate the secret, provision s' under a swapId,
 *  build and prove a counter op the normal SDK way, couple it (the LP funds the dust, the
 *  user nothing), and submit the bound tx. */
export async function coupleOnce(deps: CoupleDeps, label: string): Promise<Coupling> {
  const { ctx, userCtx, couplerAddress, counterAddress } = deps;
  logger.info(`--- ${label} ---`);
  const secrets = generateSwapSecrets();
  const swapId = crypto.randomBytes(32).toString('hex');
  await provisionSPrime(userCtx, couplerAddress, swapId, secrets.sPrime);

  const coupler = createCoupler({
    env: couplerEnv(userCtx),
    couplerAddress,
    capacity: localCapacityProvider(ctx),
    vFeeSpecks: VFEE_SPECKS,
  });

  // The dapp builds and proves its own op the normal way, no special tx construction.
  const userTx = await buildCounterIncrementTx(userCtx, counterAddress);
  const { bound } = await coupler.couple(userTx, { swapId, s: secrets.s, hPrime: secrets.hPrime });
  logger.info('Submitting...');
  const txId = await userCtx.midnightProvider.submitTx(bound);
  logger.info(`Submitted ${txId}, watching...`);
  const fin = await userCtx.publicDataProvider.watchForTxData(txId).catch((e) => {
    logger.warn(`watch failed: ${(e as Error).message}`);
    return undefined;
  });
  if (!fin || fin.status !== 'SucceedEntirely') {
    throw new Error(`coupling failed on chain: ${fin?.status ?? 'submitted'} (tx ${txId})`);
  }
  return { swapId, secrets, txHash: txId, status: fin.status };
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
    const bindCtx = { ...userApp, privateStateProvider: inMemoryPrivateStateProvider() };
    const swapId = crypto.randomBytes(32).toString('hex');
    await provisionSPrime(bindCtx, couplerAddress, swapId, secrets.sPrime);
    const bindEnv = couplerEnv(bindCtx);
    const prepared = await prepareUserFragment(bindEnv, {
      couplerAddress,
      swapId,
      s: secrets.s,
      hPrime: secrets.hPrime,
      nonce: crypto.randomBytes(32),
      vFeeSpecks: VFEE_SPECKS,
      ttl: new Date(Date.now() + USER_TTL_MS),
    });
    const wrongCapacity = await localCapacityProvider(ctx).requestCapacity(couplerAddress, {
      ...prepared.request,
      hPrime: crypto.randomBytes(32),
    });
    await finalizeCoupling(bindEnv, { couplerAddress, prepared, capacity: wrongCapacity });
    return { bindingHolds: false, wrongHPrimeError: '' };
  } catch (e) {
    return { bindingHolds: true, wrongHPrimeError: ((e as Error).message ?? String(e)).slice(0, 160) };
  }
}
