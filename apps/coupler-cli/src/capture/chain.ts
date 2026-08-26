import { existsSync, readFileSync, writeFileSync } from 'fs';
import { createEphemeralAppContext, createLogger, AppContext } from '@sundaeswap/capacity-exchange-nodejs';
import { readDisclosureAtTx } from '@sundaeswap/capacity-exchange-coupler/operations';
import { buildCounterIncrementTx } from '../local/counter.js';
import { fakeCardanoResolver, inMemoryEscrowLocker, escrowCheckingCapacity } from '../local/stubs.js';
import { prepareCoupling } from '../coupling/prepare.js';
import { captureCoupling } from './run.js';
import { buildFixture, mergeFixture, type DisclosureFixture } from './fixtures.js';

const logger = createLogger(import.meta);

/** Couple once for real against an already-deployed coupler and append what came back to a fixture
 *  file. Separate from the e2e on purpose: a capture proves nothing and asserts nothing, it only
 *  records. Deploying is coupler:deploy's job. */
export async function runCapture(
  ctx: AppContext,
  couplerAddress: string,
  counterAddress: string,
  snapshotDir: string,
  out: string
) {
  const userApp = await createEphemeralAppContext(ctx, snapshotDir);
  try {
    const indexerUrl = userApp.config.network.endpoints.indexerHttpUrl;
    const deps = {
      userApp,
      couplerAddress,
      escrow: inMemoryEscrowLocker(),
      resolver: fakeCardanoResolver(),
      capacity: escrowCheckingCapacity(ctx),
    };

    const captured = await captureCoupling({
      prepareOne: async () => prepareCoupling(deps, await buildCounterIncrementTx(userApp, counterAddress)),
      submitTx: (tx) => userApp.midnightProvider.submitTx(tx),
      awaitInclusion: (txId) => userApp.publicDataProvider.watchForTxData(txId).catch(() => undefined),
      readDisclosure: (txId) => readDisclosureAtTx(indexerUrl, couplerAddress, txId),
    });

    const fresh = buildFixture(couplerAddress, [captured]);
    const existing: DisclosureFixture | undefined = existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : undefined;
    const fixture = existing ? mergeFixture(existing, fresh) : fresh;
    writeFileSync(out, JSON.stringify(fixture, null, 2) + '\n');
    logger.info(`Saved ${captured.txId}, file now holds ${fixture.couplings.length}, at ${out}`);
    return { couplerAddress, txId: captured.txId, total: fixture.couplings.length };
  } finally {
    try {
      await userApp.walletContext.walletFacade.stop();
    } catch (err) {
      logger.warn({ err: err instanceof Error ? err : String(err) }, 'User wallet facade stop failed');
    }
  }
}
