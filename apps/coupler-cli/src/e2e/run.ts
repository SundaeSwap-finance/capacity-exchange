import { firstValueFrom } from 'rxjs';
import { createEphemeralAppContext, createLogger, AppContext } from '@sundaeswap/capacity-exchange-nodejs';
import { readDisclosureAtTx, dustUtxoId } from '@sundaeswap/capacity-exchange-coupler/operations';
import { awaitInclusion } from '../chain/awaitInclusion.js';
import { failedAssertions } from './assertions.js';
import { oneTransaction, runCouplings } from '../coupling/submit.js';
import { SCENARIOS, type Scenario } from './scenarios.js';
import { e2eReport } from './report.js';
import { buildCounterIncrementTx, readCounterRound } from '../local/counter.js';
import { prepareCoupling, type CouplingDeps } from '../coupling/prepare.js';
import {
  fakeCardanoResolver,
  inMemoryEscrowLocker,
  escrowCheckingCapacity,
  type EscrowCheckingCapacity,
} from '../local/stubs.js';

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
 * `cardano:` price) and runs the coupler, with the foreign escrow and LP stubbed.
 *
 * Each scenario submits only what its own claims need, so a failure names the property that
 * broke rather than the whole run.
 */
/** The flow's dependencies, plus what only the harness needs: the LP's own context, the counter
 *  it increments, and a capacity that keeps the books the e2e reads back. */
interface E2eDeps extends CouplingDeps {
  /** The LP, funds the dust. The user's own wallet is CouplingDeps.userApp and funds nothing. */
  ctx: AppContext;
  counterAddress: string;
  capacity: EscrowCheckingCapacity;
}

/** Every coupling prepared via balanceTx and submitted as one transaction, which is what the
 *  per-tx read was built to exercise: only the last coupling survives in the coupler's cells. */
async function submitCouplings(deps: E2eDeps, count: number) {
  const bounds = [];
  for (let i = 0; i < count; i += 1) {
    bounds.push(await prepareCoupling(deps, await buildCounterIncrementTx(deps.userApp, deps.counterAddress)));
  }
  const funded = deps.capacity.fundedCommitments();
  if (funded.length !== bounds.length) {
    throw new Error(`e2e: expected ${bounds.length} funded commitments, got ${funded.length}`);
  }
  const indexerUrl = deps.userApp.config.network.endpoints.indexerHttpUrl;
  const run = await runCouplings(oneTransaction(bounds, funded), {
    submitTx: (tx) => deps.userApp.midnightProvider.submitTx(tx),
    awaitInclusion: (txId) => awaitInclusion(deps.userApp, txId, (reason: string) => logger.warn(reason)),
    readDisclosure: (txId) => readDisclosureAtTx(indexerUrl, deps.couplerAddress, txId),
  });
  logger.info(`Submitted ${run.txIds.join(' and ')}`);
  return run;
}

/** What each side spent. The LP paid iff every dust UTxO it spent is gone from what it can still
 *  spend. A balance comparison cannot see this: dust regenerates continuously and swamps the fee. */
async function readSpend(deps: E2eDeps, asOf: Date) {
  const lpDustSpent = deps.capacity.usedDustUtxos();
  const lpDustAvailable = await availableDustUtxos(deps.ctx);
  return {
    lpDustSpent,
    lpPaid: lpDustSpent.length > 0 && lpDustSpent.every((id) => !lpDustAvailable.has(id)),
    userDustAfter: await dustBalanceAt(deps.userApp, asOf),
  };
}

export async function runE2e(
  ctx: AppContext,
  couplerAddress: string,
  counterAddress: string,
  snapshotDir: string,
  scenario: Scenario
) {
  const userApp = await createEphemeralAppContext(ctx, snapshotDir);
  try {
    // Both dust readings are taken as of one instant, so continuous regeneration cancels and
    // what is left is what the run actually spent.
    const asOf = new Date();
    const userDustBefore = await dustBalanceAt(userApp, asOf);
    const deps: E2eDeps = {
      ctx,
      userApp,
      couplerAddress,
      counterAddress,
      escrow: inMemoryEscrowLocker(),
      resolver: fakeCardanoResolver(),
      capacity: escrowCheckingCapacity(ctx),
    };

    const roundBefore = await readCounterRound(ctx, counterAddress);
    const run = await submitCouplings(deps, SCENARIOS[scenario].couplings);

    const roundAfter = await readCounterRound(ctx, counterAddress);
    const spend = await readSpend(deps, asOf);

    const report = e2eReport({
      scenario,
      couplerAddress,
      counterAddress,
      run,
      roundBefore,
      roundAfter,
      userDustBefore,
      ...spend,
    });

    const failed = failedAssertions(scenario, report);
    if (failed.length > 0) {
      throw new Error(`e2e ${scenario} failed: ${failed.join(', ')}\n${JSON.stringify(report, null, 2)}`);
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
