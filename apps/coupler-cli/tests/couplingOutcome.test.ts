import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Transaction, type SignatureEnabled, type Proof, type Binding } from '@midnight-ntwrk/ledger-v8';
import { persistentHash, CompactTypeBytes } from '@midnight-ntwrk/compact-runtime';
import { hexToBytes, uint8ArrayToHex } from '@sundaeswap/capacity-exchange-core';
import { extractDisclosed } from '@sundaeswap/capacity-exchange-coupler/operations';
import { couplingOutcome, type CouplingCommitment, type DisclosureRead } from '../src/couplingOutcome.js';

// The coupler fixtures are recorded couplings from a real chain. Reusing them here keeps this
// test offline while still exercising the real decode path the harness depends on.
const here = dirname(fileURLToPath(import.meta.url));
const fixPath = join(here, '../../../packages/coupler/tests/fixtures/disclosureTxs.json');
const fix = JSON.parse(readFileSync(fixPath, 'utf8'));

const deserialize = (raw: string): Transaction<SignatureEnabled, Proof, Binding> =>
  Transaction.deserialize<SignatureEnabled, Proof, Binding>('signature', 'proof', 'binding', hexToBytes(raw));

/** The commitments the LP holds for a coupling: h is hash(s), hPrime is the disclosed hsp. */
function commitmentOf(raw: string): CouplingCommitment {
  const result = extractDisclosed(deserialize(raw), fix.couplerAddress);
  if (!result.ok) {
    throw new Error(`fixture did not decode: ${result.error.kind}`);
  }
  const only = result.couplings[0];
  return { h: persistentHash(new CompactTypeBytes(32), only.s), hPrime: only.hsp };
}

const read = (txId: string, raw: string): DisclosureRead => ({
  txId,
  result: extractDisclosed(deserialize(raw), fix.couplerAddress),
});

const A = fix.couplings[0].raw;
const B = fix.couplings[1].raw;

describe('couplingOutcome resolves a run the same way however it was submitted', () => {
  // Submitting separately gives one read per coupling.
  it('resolves both couplings from two separate reads', () => {
    const outcome = couplingOutcome([read('tx1', A), read('tx2', B)], [commitmentOf(A), commitmentOf(B)]);

    expect(outcome.recovered).toHaveLength(2);
    expect(outcome.allFound).toBe(true);
    expect(outcome.allDistinct).toBe(true);
    expect(outcome.failures).toEqual({});
  });

  // Merging before submit gives ONE tx carrying both couplings, so one read must resolve both.
  // This is the shape the decoder used to refuse outright.
  it('resolves both couplings from a single merged read', () => {
    const merged = deserialize(A).merge(deserialize(B));
    const one: DisclosureRead = { txId: 'merged', result: extractDisclosed(merged, fix.couplerAddress) };
    const outcome = couplingOutcome([one], [commitmentOf(A), commitmentOf(B)]);

    expect(outcome.recovered).toHaveLength(2);
    expect(outcome.allFound).toBe(true);
    expect(outcome.allDistinct).toBe(true);
    expect(outcome.failures).toEqual({});
  });

  // The point of keying by commitment: each expectation resolves to ITS OWN coupling, not
  // whichever happened to be decoded first. Order in the merged tx is not the order submitted.
  it('resolves each commitment to its own coupling, not by position', () => {
    const merged = deserialize(A).merge(deserialize(B));
    const one: DisclosureRead = { txId: 'merged', result: extractDisclosed(merged, fix.couplerAddress) };
    const [specA, specB] = [commitmentOf(A), commitmentOf(B)];

    const outcome = couplingOutcome([one], [specA, specB]);
    const soloA = extractDisclosed(deserialize(A), fix.couplerAddress);
    const soloB = extractDisclosed(deserialize(B), fix.couplerAddress);
    if (!soloA.ok || !soloB.ok) {
      throw new Error('fixtures did not decode alone');
    }

    expect(uint8ArrayToHex(outcome.bySpec[0]!.s)).toBe(uint8ArrayToHex(soloA.couplings[0].s));
    expect(uint8ArrayToHex(outcome.bySpec[1]!.s)).toBe(uint8ArrayToHex(soloB.couplings[0].s));
    // ... and crossing the expectations must not still resolve.
    const crossed = couplingOutcome([one], [{ h: specA.h, hPrime: specB.hPrime }]);
    expect(crossed.allFound).toBe(false);
  });

  it('reports a failed read by its txId rather than throwing', () => {
    const bad: DisclosureRead = { txId: 'tx1', result: { ok: false, error: { kind: 'noMintReveal' } } };
    const outcome = couplingOutcome([bad, read('tx2', B)], [commitmentOf(B)]);

    expect(outcome.failures).toEqual({ tx1: 'noMintReveal' });
    expect(outcome.allFound).toBe(true);
  });
});
