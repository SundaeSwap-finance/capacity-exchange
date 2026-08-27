import { firstValueFrom } from 'rxjs';
import type { FinalizedTransaction } from '@midnight-ntwrk/ledger-v8';
import { writeFileSync } from 'fs';
import { createEphemeralAppContext, createLogger, AppContext } from '@sundaeswap/capacity-exchange-nodejs';
import { readDisclosureAtTx, dustUtxoId } from '@sundaeswap/capacity-exchange-coupler/operations';
import { uint8ArrayToHex } from '@sundaeswap/capacity-exchange-core';
import { failedAssertions } from './assertions.js';
import { runCouplings, type CouplingRunResult } from '../coupling/submit.js';
import { e2eReport } from './report.js';
import { buildCounterIncrementTx, readCounterRound } from '../local/counter.js';
import { prepareCoupling, type CouplingDeps } from '../coupling/prepare.js';
import {
  fakeCardanoResolver,
  inMemoryEscrowLocker,
  escrowCheckingCapacity,
  type EscrowCheckingCapacity,
} from '../local/stubs.js';
import { checkBinding } from './binding.js';

const logger = createLogger(import.meta);

/** A wallet's dust at a fixed instant, so continuous regeneration cancels between reads. */
async function dustBalanceAt(app: AppContext, at: Date): Promise<bigint> {
  return (await firstValueFrom(app.walletContext.walletFacade.state())).dust.balance(at);
}

/** The dust UTxOs a wallet can still spend, by id. */
async function availableDustUtxos(app: AppContext): Promise<Set<string>> {
  const dust = (await firstValueFrom(app.walletContext.walletFacade.state())).dust;
  const coins = dust.capabilities.coinsAndBalances.getAvailableCoins(dust.state, new Date());
  return new Set(coins.map(dustUtxoId));
}

/**
 * TEST HARNESS ONLY, not a protocol flow: one process plays both parties (a funded LP wallet and a
 * brand-new empty user wallet). The user drives the real WalletProvider: it builds a normal op and
 * passes it to `balanceTx`, which takes the bridgeless path (the only quoted currency is a fake
 * `cardano:` price) and runs the coupler, with the foreign escrow and LP stubbed. It runs TWO
 * couplings in one block to prove:
 *  1. each coupling lands as a bridgeless exchange (the LP funds the dust, the user spends none)
 *  2. per-tx extraction: sharing a block, each coupling's disclosed s and hsp are recovered by its
 *     own txId and are distinct (live-state would collapse them to one value)
 *  3. binding: a coupling whose capacity used the WRONG h' must fail
 */
/** The flow's dependencies, plus what only the harness needs: the LP's own context and the
 *  counter it increments. */
interface E2eDeps extends CouplingDeps {
  /** The LP, funds the dust. The user's own wallet is CouplingDeps.userApp and funds nothing. */
  ctx: AppContext;
  counterAddress: string;
}

/** Two couplings prepared via balanceTx, one tx each so they land in the same block, which is
 *  what the per-tx read was built to exercise. */
async function submitCouplings(deps: E2eDeps, capacity: EscrowCheckingCapacity) {
  const userTx = () => buildCounterIncrementTx(deps.userApp, deps.counterAddress);
  const bounds = [await prepareCoupling(deps, await userTx()), await prepareCoupling(deps, await userTx())];
  const funded = capacity.fundedCommitments();
  if (funded.length !== bounds.length) {
    throw new Error(`e2e: expected ${bounds.length} funded commitments, got ${funded.length}`);
  }
  const indexerUrl = deps.userApp.config.network.endpoints.indexerHttpUrl;
  const run = await runCouplings(
    bounds.map((bound, i) => ({ bound, expected: [funded[i]] })),
    {
      submitTx: (tx) => deps.userApp.midnightProvider.submitTx(tx),
      awaitInclusion: (txId) => deps.userApp.publicDataProvider.watchForTxData(txId).catch(() => undefined),
      readDisclosure: (txId) => readDisclosureAtTx(indexerUrl, deps.couplerAddress, txId),
    }
  );
  logger.info(`Submitted ${run.txIds.join(' and ')}`);
  return { bounds, run };
}

/** Regenerating the disclosure test fixtures needs the submitted bytes plus what each coupling
 *  disclosed. Both are here and nowhere else, so capture them when asked. */
function captureFixtures(path: string, couplerAddress: string, bounds: FinalizedTransaction[], run: CouplingRunResult) {
  const entries = bounds.map((bound, i) => {
    const read = run.reads[i];
    const coupling = read?.result.ok ? read.result.couplings[0] : undefined;
    return {
      label: `coupling${i + 1}`,
      txId: run.txIds[i],
      raw: uint8ArrayToHex(bound.serialize()),
      expectedS: coupling ? uint8ArrayToHex(coupling.s) : undefined,
      expectedHsp: coupling ? uint8ArrayToHex(coupling.hsp) : undefined,
    };
  });
  writeFileSync(path, JSON.stringify({ couplerAddress, entries }, null, 2) + '\n');
  logger.info(`Captured ${entries.length} transactions to ${path}`);
}

/** What the LP spent and what the user spent. The LP paid iff every dust UTxO it spent is gone
 *  from what it can still spend. A balance comparison cannot see this: dust regenerates
 *  continuously and swamps the fee. */
async function readPayment(ctx: AppContext, userApp: AppContext, capacity: EscrowCheckingCapacity, at: Date) {
  const lpDustSpent = capacity.usedDustUtxos();
  const lpDustAvailable = await availableDustUtxos(ctx);
  return {
    lpDustSpent,
    lpPaid: lpDustSpent.length > 0 && lpDustSpent.every((id) => !lpDustAvailable.has(id)),
    userDustAfter: await dustBalanceAt(userApp, at),
  };
}

export async function runE2e(
  ctx: AppContext,
  couplerAddress: string,
  counterAddress: string,
  snapshotDir: string
) {
  const userApp = await createEphemeralAppContext(ctx, snapshotDir);
  try {
    const at = new Date();
    const userDustBefore = await dustBalanceAt(userApp, at);
    const capacity = escrowCheckingCapacity(ctx);
    const deps: E2eDeps = {
      ctx,
      userApp,
      couplerAddress,
      counterAddress,
      escrow: inMemoryEscrowLocker(),
      resolver: fakeCardanoResolver(),
      capacity,
    };

    const roundBefore = await readCounterRound(ctx, counterAddress);
    const { bounds, run } = await submitCouplings(deps, capacity);

    const capturePath = process.env.CAPTURE_FIXTURES;
    if (capturePath) {
      captureFixtures(capturePath, couplerAddress, bounds, run);
    }

    const roundAfter = await readCounterRound(ctx, counterAddress);
    const binding = await checkBinding(ctx, userApp, couplerAddress);
    const payment = await readPayment(ctx, userApp, capacity, at);

    const report = e2eReport({
      couplerAddress,
      counterAddress,
      run,
      roundBefore,
      roundAfter,
      userDustBefore,
      binding,
      ...payment,
    });

    const failed = failedAssertions(report);
    if (failed.length > 0) {
      throw new Error(`e2e failed: ${failed.join(', ')}\n${JSON.stringify(report, null, 2)}`);
    }
    return report;
  } finally {
    try {
      await userApp.walletContext.walletFacade.stop();
    } catch (err) {
      logger.warn({ err: err instanceof Error ? err : String(err) }, 'User wallet facade stop failed');
    }
  }
}
