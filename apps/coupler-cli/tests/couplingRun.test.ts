import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Transaction, type SignatureEnabled, type Proof, type Binding } from '@midnight-ntwrk/ledger-v8';
import { persistentHash, CompactTypeBytes } from '@midnight-ntwrk/compact-runtime';
import { hexToBytes, uint8ArrayToHex } from '@sundaeswap/capacity-exchange-core';
import { extractDisclosed } from '@sundaeswap/capacity-exchange-coupler/operations';
import { runCouplings, type CouplingRunDeps } from '../src/couplingRun.js';
import type { CouplingCommitment } from '../src/couplingOutcome.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixPath = join(here, '../../../packages/coupler/tests/fixtures/disclosureTxs.json');
const fix = JSON.parse(readFileSync(fixPath, 'utf8'));

const deserialize = (raw: string): Transaction<SignatureEnabled, Proof, Binding> =>
  Transaction.deserialize<SignatureEnabled, Proof, Binding>('signature', 'proof', 'binding', hexToBytes(raw));

function commitmentOf(raw: string): CouplingCommitment {
  const result = extractDisclosed(deserialize(raw), fix.couplerAddress);
  if (!result.ok) {
    throw new Error(`fixture did not decode: ${result.error.kind}`);
  }
  const only = result.couplings[0];
  return { h: persistentHash(new CompactTypeBytes(32), only.s), hPrime: only.hsp };
}

/** A chain that keeps whatever it was handed and reads disclosures back out of it, so a run can
 *  be driven end to end without a node. */
function fakeChain(): CouplingRunDeps & { seen: Map<string, Transaction<SignatureEnabled, Proof, Binding>> } {
  const seen = new Map<string, Transaction<SignatureEnabled, Proof, Binding>>();
  return {
    seen,
    submitTx: async (tx) => {
      const id = `tx${seen.size + 1}`;
      seen.set(id, tx);
      return id;
    },
    awaitInclusion: async () => ({ status: 'SucceedEntirely' }),
    readDisclosure: async (txId) => {
      const tx = seen.get(txId);
      if (tx == null) {
        return { ok: false, error: { kind: 'txUnavailable', detail: `no such tx ${txId}` } };
      }
      return extractDisclosed(tx, fix.couplerAddress);
    },
  };
}

/** A chain that will not serve a tx until its inclusion has been awaited, which is what a real
 *  indexer does. queryTxRaw treats zero rows as "not yet indexed", so a run that reads before
 *  waiting gets txUnavailable. The permissive fake above cannot see that ordering at all. */
function inclusionGatedChain(): CouplingRunDeps & { included: Set<string> } {
  const seen = new Map<string, Transaction<SignatureEnabled, Proof, Binding>>();
  const included = new Set<string>();
  return {
    included,
    submitTx: async (tx) => {
      const id = `tx${seen.size + 1}`;
      seen.set(id, tx);
      return id;
    },
    awaitInclusion: async (txId) => {
      included.add(txId);
      return { status: 'SucceedEntirely' };
    },
    readDisclosure: async (txId) => {
      if (!included.has(txId)) {
        return { ok: false, error: { kind: 'txUnavailable', detail: `not indexed yet: ${txId}` } };
      }
      const tx = seen.get(txId);
      if (tx == null) {
        return { ok: false, error: { kind: 'txUnavailable', detail: `no such tx ${txId}` } };
      }
      return extractDisclosed(tx, fix.couplerAddress);
    },
  };
}

const A = fix.couplings[0].raw;
const B = fix.couplings[1].raw;
const specs = (): CouplingCommitment[] => [commitmentOf(A), commitmentOf(B)];

describe('runCouplings submits, waits, then reads', () => {
  it('yields one tx and one read per coupling', async () => {
    const chain = fakeChain();
    const run = await runCouplings([deserialize(A), deserialize(B)], specs(), chain);

    expect(run.txIds).toHaveLength(2);
    expect(run.reads).toHaveLength(2);
    expect(run.outcome.allFound).toBe(true);
    expect(run.outcome.allDistinct).toBe(true);
  });

  // Each expectation must resolve to its own coupling, so a caller holding one escrow reads
  // its own secret out of a tx that also settled somebody else's.
  it('resolves each funded commitment to its own coupling', async () => {
    const chain = fakeChain();
    const [specA, specB] = specs();
    const run = await runCouplings([deserialize(A), deserialize(B)], [specA, specB], chain);

    const soloA = extractDisclosed(deserialize(A), fix.couplerAddress);
    const soloB = extractDisclosed(deserialize(B), fix.couplerAddress);
    if (!soloA.ok || !soloB.ok) {
      throw new Error('fixtures did not decode alone');
    }
    expect(uint8ArrayToHex(run.outcome.bySpec[0]!.s)).toBe(uint8ArrayToHex(soloA.couplings[0].s));
    expect(uint8ArrayToHex(run.outcome.bySpec[1]!.s)).toBe(uint8ArrayToHex(soloB.couplings[0].s));
  });

  // Reads must happen AFTER inclusion. Confirmed against preview: submitting two couplings and
  // reading immediately leaves the second unreadable, because it has not been indexed yet.
  it('waits for inclusion before reading', async () => {
    const chain = inclusionGatedChain();
    const run = await runCouplings([deserialize(A), deserialize(B)], specs(), chain);

    expect(run.outcome.failures).toEqual({});
    expect(run.outcome.allFound).toBe(true);
    expect(chain.included.size).toBe(2);
  });

  it('reports what each submission finalized as', async () => {
    const chain = inclusionGatedChain();
    const run = await runCouplings([deserialize(A), deserialize(B)], specs(), chain);

    expect(run.finals).toHaveLength(2);
    expect(run.finals.every((f) => f?.status === 'SucceedEntirely')).toBe(true);
  });

  it('surfaces a failed read by tx id instead of throwing', async () => {
    const chain = fakeChain();
    const run = await runCouplings([deserialize(A)], [commitmentOf(A)], {
      ...chain,
      readDisclosure: async () => ({ ok: false, error: { kind: 'txUnavailable', detail: 'indexer down' } }),
    });

    expect(run.outcome.failures).toEqual({ tx1: 'txUnavailable' });
    expect(run.outcome.allFound).toBe(false);
  });
});
