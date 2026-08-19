import { firstValueFrom } from 'rxjs';
import { createEphemeralAppContext, createLogger, AppContext } from '@sundaeswap/capacity-exchange-nodejs';
import { readDisclosureAtTx, dustUtxoId } from '@sundaeswap/capacity-exchange-coupler/operations';
import { writeFileSync } from 'fs';
import { uint8ArrayToHex } from '@sundaeswap/capacity-exchange-core';
import { runCouplings } from './couplingRun.js';
import { deploy } from './deploy.js';
import { readCounterRound } from './counter.js';
import {
  prepareCoupling,
  inMemoryEscrowLocker,
  escrowCheckingCapacity,
  type BridgelessE2eDeps,
} from './e2e-bridgeless.js';
import { checkBinding } from './e2e-flows.js';

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
 *  1. each coupling lands with purchased capacity (the LP pays the dust, the user nothing)
 *  2. per-tx extraction: sharing a block, each coupling's disclosed s and hsp are recovered by its
 *     own txId and are distinct (live-state would collapse them to one value)
 *  3. binding: a coupling whose capacity used the WRONG h' must fail
 */
export async function runE2e(ctx: AppContext, counterAddress: string, snapshotDir: string) {
  const userApp = await createEphemeralAppContext(ctx, snapshotDir);
  try {
    const at = new Date();
    const userDustBefore = await dustBalanceAt(userApp, at);

    // Reusing a coupler lets a second run add couplings to the same contract, which is what
    // regenerating the fixtures needs. Deploying is the default.
    const existing = process.env.COUPLER_ADDRESS;
    const couplerAddress = existing ?? (await deploy(ctx)).contractAddress;
    if (existing) {
      logger.info(`Reusing coupler ${existing}`);
    }
    const escrow = inMemoryEscrowLocker();
    const capacity = escrowCheckingCapacity(ctx);
    const deps: BridgelessE2eDeps = { ctx, userApp, couplerAddress, counterAddress, escrow, capacity };

    const roundBefore = await readCounterRound(ctx, counterAddress);

    // Two couplings prepared via balanceTx, submitted as one tx each so they land in the same
    // block, which is what the per-tx read was built to exercise.
    const bound1 = await prepareCoupling(deps);
    const bound2 = await prepareCoupling(deps);
    const indexerUrl = userApp.config.network.endpoints.indexerHttpUrl;
    const run = await runCouplings([bound1, bound2], capacity.fundedCommitments(), {
      submitTx: (tx) => userApp.midnightProvider.submitTx(tx),
      awaitInclusion: (txId) => userApp.publicDataProvider.watchForTxData(txId).catch(() => undefined),
      readDisclosure: (txId) => readDisclosureAtTx(indexerUrl, couplerAddress, txId),
    });
    logger.info(`Submitted ${run.txIds.join(' and ')}`);

    // Regenerating the disclosure test fixtures needs the submitted bytes plus what each coupling
    // disclosed. Both are here and nowhere else, so capture them when asked.
    const capturePath = process.env.CAPTURE_FIXTURES;
    if (capturePath) {
      const entries = [bound1, bound2].map((bound, i) => {
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
      writeFileSync(capturePath, JSON.stringify({ couplerAddress, entries }, null, 2) + '\n');
      logger.info(`Captured ${entries.length} transactions to ${capturePath}`);
    }

    const roundAfter = await readCounterRound(ctx, counterAddress);

    const binding = await checkBinding(ctx, userApp, couplerAddress);

    // The LP paid iff every dust UTxO it spent is gone from what it can still spend.
    // A balance comparison cannot see this: dust regenerates continuously and swamps the fee.
    const lpDustSpent = capacity.usedDustUtxos();
    const lpDustAvailable = await availableDustUtxos(ctx);
    const userDustAfter = await dustBalanceAt(userApp, at);

    return {
      couplerAddress,
      txIds: run.txIds,
      allLanded: run.finals.length > 0 && run.finals.every((fin) => fin?.status === 'SucceedEntirely'),
      // Every coupling the LP funded is recovered, resolved by its own commitment rather than
      // by position, and no two couplings decode to the same secret. Two couplings in one block
      // is the case a live-state read would collapse to the last write.
      allCouplingsRecovered: run.outcome.allFound,
      couplingsDistinct: run.outcome.allDistinct,
      disclosures: run.reads.map((read) => (read.result.ok ? read.result.couplings : read.result.error)),
      readFailures: run.outcome.failures,
      counter: {
        address: counterAddress,
        roundBefore: String(roundBefore),
        roundAfter: String(roundAfter),
        incrementedTwice: roundAfter === roundBefore + 2n,
      },
      lpDustSpent,
      lpPaid: lpDustSpent.length > 0 && lpDustSpent.every((id) => !lpDustAvailable.has(id)),
      userDustBefore: String(userDustBefore),
      userDustAfter: String(userDustAfter),
      userPaidNothing: userDustAfter === userDustBefore,
      bindingHolds: binding.bindingHolds,
      wrongHPrimeError: binding.wrongHPrimeError,
    };
  } finally {
    try {
      await userApp.walletContext.walletFacade.stop();
    } catch (err) {
      logger.warn({ err: err instanceof Error ? err : String(err) }, 'User wallet facade stop failed');
    }
  }
}
