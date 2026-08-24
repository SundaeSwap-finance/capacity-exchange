import { describe, it, expect, vi } from 'vitest';
import { writeSPrimeWitness } from '../src/lib/secrets.js';
import type { PrivateStateProvider } from '@midnight-ntwrk/midnight-js/types';

/** A store that records what was written, standing in for whatever the SDK supplies. */
function recordingStore() {
  const written = new Map<string, unknown>();
  const store = {
    setContractAddress: vi.fn(),
    set: vi.fn(async (key: string, value: unknown) => {
      written.set(key, value);
    }),
    get: vi.fn(async (key: string) => written.get(key)),
  } as unknown as PrivateStateProvider;
  return { store, written };
}

describe("s' must outlive the pay call", () => {
  // SDK.md: s' must persist until the escrow reaches a terminal state. pay() returns a bound
  // tx that the CALLER submits, so a submit that fails needs s' again to rebuild the reveal
  // leg. If the library created its own in-memory store and dropped it on return, a transient
  // submit failure would force the user to wait out eTTL and refund, losing the swap and the
  // dust the LP already committed.
  it('writes the witness into the caller-supplied store, keyed by swapId', async () => {
    const { store, written } = recordingStore();
    const sPrime = new Uint8Array(32).fill(7);

    await writeSPrimeWitness(store, 'coupler-addr', 'swap-1', sPrime);

    expect(written.has('swap-1')).toBe(true);
    // The caller still holds the store after the call, which is the whole point.
    expect(await (store as unknown as { get(k: string): Promise<unknown> }).get('swap-1')).toBeDefined();
  });

  it('keys each swap separately, so concurrent swaps do not clobber each other', async () => {
    const { store, written } = recordingStore();

    await writeSPrimeWitness(store, 'coupler-addr', 'swap-1', new Uint8Array(32).fill(1));
    await writeSPrimeWitness(store, 'coupler-addr', 'swap-2', new Uint8Array(32).fill(2));

    expect(written.size).toBe(2);
    expect(written.get('swap-1')).not.toEqual(written.get('swap-2'));
  });
});
