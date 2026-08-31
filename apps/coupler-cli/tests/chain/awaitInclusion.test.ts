import { describe, it, expect, vi } from 'vitest';
import type { AppContext } from '@sundaeswap/capacity-exchange-nodejs';
import { awaitInclusion, InclusionTimeout } from '../../src/chain/awaitInclusion.js';

/** A chain that records which tx it was asked about, so watching the wrong one cannot pass. */
function chain(watch: (txId: string) => Promise<unknown>) {
  const asked: string[] = [];
  const app = {
    publicDataProvider: {
      watchForTxData: (txId: string) => {
        asked.push(txId);
        return watch(txId);
      },
    },
  } as unknown as AppContext;
  return { app, asked };
}

const never = () => new Promise<never>(() => {});

describe('waiting for inclusion is bounded', () => {
  it('returns what the chain reported, for the tx it was asked about', async () => {
    const said: string[] = [];
    const { app, asked } = chain(async () => ({ status: 'SucceedEntirely' }));

    const result = await awaitInclusion(app, 'tx1', (r) => said.push(r), 1_000);

    expect(result).toEqual({ status: 'SucceedEntirely' });
    expect(asked).toEqual(['tx1']);
    expect(said).toEqual([]);
  });

  // The watch polls the indexer and never gives up on its own, so this bound is the whole point.
  // Asserting the elapsed time brackets the budget is what stops a fixed wait passing as a bound.
  it('gives up close to the deadline it was given, not later', async () => {
    const { app } = chain(never);
    const started = Date.now();

    await expect(awaitInclusion(app, 'tx1', () => {}, 120)).rejects.toThrow(InclusionTimeout);

    const elapsed = Date.now() - started;
    expect(elapsed).toBeGreaterThanOrEqual(100);
    expect(elapsed).toBeLessThan(400);
  });

  it('honours a different deadline rather than a fixed one', async () => {
    const { app } = chain(never);
    const started = Date.now();

    await expect(awaitInclusion(app, 'tx1', () => {}, 400)).rejects.toThrow(InclusionTimeout);

    expect(Date.now() - started).toBeGreaterThanOrEqual(350);
  });

  // Giving up is not evidence the tx failed, so it must not come back looking like a chain answer.
  it('names the tx and the budget when it gives up', async () => {
    const { app } = chain(never);

    await expect(awaitInclusion(app, 'txAbc', () => {}, 50)).rejects.toThrow(/txAbc.*50ms/);
  });

  // A failed watch IS survivable, so it stays a value rather than becoming a throw.
  it('reports a failed watch as no answer rather than throwing', async () => {
    const said: string[] = [];
    const { app } = chain(async () => {
      throw new Error('socket closed');
    });

    await expect(awaitInclusion(app, 'tx1', (r) => said.push(r), 1_000)).resolves.toBeUndefined();
    expect(said.join(' ')).toMatch(/socket closed/);
  });

  // A timer left armed holds the event loop and later rejects about a tx that already landed, so
  // the clearing is the contract rather than an implementation detail.
  it('leaves no timer behind once the chain has answered', async () => {
    const cleared = vi.spyOn(globalThis, 'clearTimeout');
    const { app } = chain(async () => ({ status: 'SucceedEntirely' }));

    await awaitInclusion(app, 'tx1', () => {}, 60);

    expect(cleared).toHaveBeenCalled();
    cleared.mockRestore();
  });
});
