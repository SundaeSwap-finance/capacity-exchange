import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Transaction, type SignatureEnabled, type Proof, type Binding } from '@midnight-ntwrk/ledger-v8';
import { persistentHash, CompactTypeBytes } from '@midnight-ntwrk/compact-runtime';
import { hexToBytes, uint8ArrayToHex } from '@sundaeswap/capacity-exchange-core';
import { extractDisclosed } from '@sundaeswap/capacity-exchange-coupler/operations';
import { couplingOutcome, type CouplingCommitment, type DisclosureRead } from '../../src/coupling/commitments.js';

// The coupler fixtures are recorded couplings from a real chain. Reusing them here keeps this
// test offline while still exercising the real decode path the harness depends on.
const here = dirname(fileURLToPath(import.meta.url));
const fixPath = join(here, '../../../../packages/coupler/tests/fixtures/disclosureTxs.json');
const fix = JSON.parse(readFileSync(fixPath, 'utf8'));

const deserialize = (raw: string): Transaction<SignatureEnabled, Proof, Binding> =>
  Transaction.deserialize<SignatureEnabled, Proof, Binding>('signature', 'proof', 'binding', hexToBytes(raw));

/** The commitments the LP holds for a coupling: h is hash(s), hPrime is the disclosed hsp. */
function commitmentOf(entry: Fixture): CouplingCommitment {
  const result = extractDisclosed(deserialize(entry.raw), entry.couplerAddress);
  if (!result.ok) {
    throw new Error(`fixture did not decode: ${result.error.kind}`);
  }
  const only = result.couplings[0];
  return { h: persistentHash(new CompactTypeBytes(32), only.s), hPrime: only.hsp };
}

const read = (txId: string, entry: Fixture): DisclosureRead => ({
  txId,
  result: extractDisclosed(deserialize(entry.raw), entry.couplerAddress),
});

type Fixture = { label: string; raw: string; couplerAddress: string };

const byLabel = (label: string): Fixture => {
  const found = fix.couplings.find((c: Fixture) => c.label === label);
  if (found == null) {
    throw new Error(`no fixture labelled ${label}`);
  }
  return found;
};

// A run drives the one coupler it deployed, so both couplings here come from a single one.
const COUPLER = byLabel('coupling1').couplerAddress;
const [A, B] = fix.couplings.filter((c: Fixture) => c.couplerAddress === COUPLER);

describe('couplingOutcome resolves a run the same way however it was submitted', () => {
  // Submitting separately gives one read per coupling.
  it('resolves both couplings from two separate reads', () => {
    const outcome = couplingOutcome(
      [read('tx1', A), read('tx2', B)],
      [
        { txId: 'tx1', couplings: [commitmentOf(A)] },
        { txId: 'tx2', couplings: [commitmentOf(B)] },
      ]
    );

    expect(outcome.recovered).toHaveLength(2);
    expect(outcome.allFound).toBe(true);
    expect(outcome.allDistinct).toBe(true);
    expect(outcome.failures).toEqual({});
  });

  // Merging before submit gives ONE tx carrying both couplings, so one read must resolve both.
  // This is the shape the decoder used to refuse outright.
  it('resolves both couplings from a single merged read', () => {
    const merged = deserialize(A.raw).merge(deserialize(B.raw));
    const one: DisclosureRead = { txId: 'merged', result: extractDisclosed(merged, COUPLER) };
    const outcome = couplingOutcome([one], [{ txId: 'merged', couplings: [commitmentOf(A), commitmentOf(B)] }]);

    expect(outcome.recovered).toHaveLength(2);
    expect(outcome.allFound).toBe(true);
    expect(outcome.allDistinct).toBe(true);
    expect(outcome.failures).toEqual({});
  });

  // The point of keying by commitment: each expectation resolves to ITS OWN coupling, not
  // whichever happened to be decoded first. Order in the merged tx is not the order submitted.
  it('resolves each commitment to its own coupling, not by position', () => {
    const merged = deserialize(A.raw).merge(deserialize(B.raw));
    const one: DisclosureRead = { txId: 'merged', result: extractDisclosed(merged, COUPLER) };
    const [specA, specB] = [commitmentOf(A), commitmentOf(B)];

    const outcome = couplingOutcome([one], [{ txId: 'merged', couplings: [specA, specB] }]);
    const soloA = extractDisclosed(deserialize(A.raw), A.couplerAddress);
    const soloB = extractDisclosed(deserialize(B.raw), B.couplerAddress);
    if (!soloA.ok || !soloB.ok) {
      throw new Error('fixtures did not decode alone');
    }

    expect(uint8ArrayToHex(outcome.bySpec[0]!.s)).toBe(uint8ArrayToHex(soloA.couplings[0].s));
    expect(uint8ArrayToHex(outcome.bySpec[1]!.s)).toBe(uint8ArrayToHex(soloB.couplings[0].s));
    // ... and crossing the expectations must not still resolve.
    const crossed = couplingOutcome([one], [{ txId: 'merged', couplings: [{ h: specA.h, hPrime: specB.hPrime }] }]);
    expect(crossed.allFound).toBe(false);
  });

  it('reports a failed read by its txId rather than throwing', () => {
    const bad: DisclosureRead = { txId: 'tx1', result: { ok: false, error: { kind: 'noMintReveal' } } };
    const outcome = couplingOutcome([bad, read('tx2', B)], [{ txId: 'tx2', couplings: [commitmentOf(B)] }]);

    expect(outcome.failures).toEqual({ tx1: 'noMintReveal' });
    expect(outcome.allFound).toBe(true);
  });

  // allDistinct stands for "no two couplings decode to the same secret". A pair key cannot say
  // that: reusing s while hsp differs keeps the pair unique and the reused secret invisible.
  it('reports a reused secret even when the other disclosed value differs', () => {
    const sharedS = hexToBytes('11'.repeat(32));
    const synthetic: DisclosureRead = {
      txId: 'tx1',
      result: {
        ok: true,
        couplings: [
          { s: sharedS, hsp: hexToBytes('22'.repeat(32)), domainSep: hexToBytes('aa'.repeat(32)), tokenColor: 'c' },
          { s: sharedS, hsp: hexToBytes('33'.repeat(32)), domainSep: hexToBytes('bb'.repeat(32)), tokenColor: 'c' },
        ],
      },
    } as unknown as DisclosureRead;

    expect(couplingOutcome([synthetic], []).allDistinct).toBe(false);
  });

  // The mirror: a reused hsp under different secrets is equally a regression.
  it('reports a reused hsp even when the secrets differ', () => {
    const sharedHsp = hexToBytes('44'.repeat(32));
    const synthetic: DisclosureRead = {
      txId: 'tx1',
      result: {
        ok: true,
        couplings: [
          { s: hexToBytes('55'.repeat(32)), hsp: sharedHsp, domainSep: hexToBytes('cc'.repeat(32)), tokenColor: 'c' },
          { s: hexToBytes('66'.repeat(32)), hsp: sharedHsp, domainSep: hexToBytes('dd'.repeat(32)), tokenColor: 'c' },
        ],
      },
    } as unknown as DisclosureRead;

    expect(couplingOutcome([synthetic], []).allDistinct).toBe(false);
  });

  // allFound stands for each coupling being recovered from the tx that carried it. Pooling every
  // read first cannot say that: a read that returned somebody else's coupling would still satisfy
  // it, and immunity to the later overwrite is the whole claim.
  it('does not count a coupling recovered from a tx that did not carry it', () => {
    const outcome = couplingOutcome(
      [read('tx1', B), read('tx2', A)],
      [
        { txId: 'tx1', couplings: [commitmentOf(A)] },
        { txId: 'tx2', couplings: [commitmentOf(B)] },
      ]
    );

    expect(outcome.allFound).toBe(false);
  });

  // Merged submission puts both couplings in one tx, so both are attributed to that same txId.
  it('attributes every coupling of a merged tx to that one txId', () => {
    const merged = deserialize(A.raw).merge(deserialize(B.raw));
    const one: DisclosureRead = { txId: 'merged', result: extractDisclosed(merged, COUPLER) };
    const outcome = couplingOutcome([one], [{ txId: 'merged', couplings: [commitmentOf(A), commitmentOf(B)] }]);

    expect(outcome.allFound).toBe(true);
  });
});
