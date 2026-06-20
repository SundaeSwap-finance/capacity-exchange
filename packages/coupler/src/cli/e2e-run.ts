import { createEphemeralAppContext, createLogger, AppContext } from '@sundaeswap/capacity-exchange-nodejs';
import { inMemoryPrivateStateProvider, uint8ArrayToHex } from '@sundaeswap/capacity-exchange-core';
import { deploy, verifyAtTx } from '../lib/operations.js';
import { type CircuitPrivateState } from '../lib/witnesses.js';
import { readCounterRound } from '../lib/counter.js';
import { coupleOnce, checkBinding, type CoupleDeps } from './e2e-flows.js';
import { dustBalanceAt, couplingResult, sPrimeRetained } from './e2e-report.js';

const logger = createLogger(import.meta);

/**
 * TEST HARNESS ONLY, not a protocol flow: one process plays both parties (a funded LP
 * wallet and a brand-new empty user wallet) with throwaway secrets it prints. It drives
 * the production shape: prove the op, couple it (createCoupler then couple), submit the
 * bound tx (the path a dapp uses, minus the Cardano escrow), and runs TWO swaps to prove:
 *  1. each coupling lands with purchased capacity (the LP pays the dust, the user nothing)
 *  2. fresh secret per swap: distinct s' and on-chain hsp, no overwrite across swaps
 *  3. per-tx extraction: each coupling's s and hsp are recovered by its own txId, even
 *     after the second overwrites the live cells
 *  4. binding: a coupling whose capacity used the WRONG h' must fail
 * The LP side sits behind localCapacityProvider, swappable for a CES-server impl.
 */
export async function runE2e(ctx: AppContext, counterAddress: string, snapshotDir: string) {
  // A real, separate user: a brand-new empty wallet (no dust), primed from the chain
  // snapshot. The LP (ctx) funds the couplings, the user funds nothing.
  const userApp = await createEphemeralAppContext(ctx, snapshotDir);
  try {
    const at = new Date();
    const lpDustBefore = await dustBalanceAt(ctx, at);
    const userDustBefore = await dustBalanceAt(userApp, at);

    const deployResult = await deploy(ctx);
    const couplerAddress = deployResult.contractAddress;

    // One user, one private-state store, two swaps in the session.
    const userPsp = inMemoryPrivateStateProvider();
    const deps: CoupleDeps = {
      ctx,
      userCtx: { ...userApp, privateStateProvider: userPsp },
      couplerAddress,
      counterAddress,
    };

    const roundBefore = await readCounterRound(ctx, counterAddress);
    const c1 = await coupleOnce(deps, 'Coupling 1');
    const c2 = await coupleOnce(deps, 'Coupling 2');
    const roundAfter = await readCounterRound(ctx, counterAddress);

    const v1 = await verifyAtTx(ctx, couplerAddress, c1.txHash);
    const v2 = await verifyAtTx(ctx, couplerAddress, c2.txHash);

    const ps1 = (await userPsp.get(c1.swapId)) as CircuitPrivateState | null;
    const ps2 = (await userPsp.get(c2.swapId)) as CircuitPrivateState | null;

    const binding = await checkBinding(ctx, userApp, couplerAddress);

    const lpDustAfter = await dustBalanceAt(ctx, at);
    const userDustAfter = await dustBalanceAt(userApp, at);

    return {
      deploy: deployResult,
      coupling1: couplingResult(c1, v1),
      coupling2: couplingResult(c2, v2),
      // c2 overwrote the live cell, yet c1's s is still recovered by its own txId.
      firstSurvivesOverwrite: v1.lastS === uint8ArrayToHex(c1.secrets.s) && v1.lastS !== v2.lastS,
      // Fresh secret per swap: distinct witnesses and distinct on-chain hsp.
      freshSPrimePerCoupling:
        uint8ArrayToHex(c1.secrets.sPrime) !== uint8ArrayToHex(c2.secrets.sPrime) && v1.lastHsp !== v2.lastHsp,
      bothSecretsRetained: sPrimeRetained(ps1, c1.secrets.sPrime) && sPrimeRetained(ps2, c2.secrets.sPrime),
      counter: {
        address: counterAddress,
        roundBefore: String(roundBefore),
        roundAfter: String(roundAfter),
        incrementedTwice: roundAfter === roundBefore + 2n,
      },
      lpDustBefore: String(lpDustBefore),
      lpDustAfter: String(lpDustAfter),
      lpPaid: lpDustBefore > lpDustAfter,
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
