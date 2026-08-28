import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  Transaction,
  rawTokenType,
  type SignatureEnabled,
  type Proof,
  type Binding,
  type ContractCall,
  type Op,
  type AlignedValue,
} from '@midnight-ntwrk/ledger-v8';
import { persistentHash, CompactTypeBytes } from '@midnight-ntwrk/compact-runtime';
import { uint8ArrayToHex } from '@sundaeswap/capacity-exchange-core';
import { extractDisclosed, couplingDomainSep, findCoupling, type Disclosure } from '../src/lib/disclosure.js';

// Real preview coupling txs captured as raw fixtures, so this runs offline in milliseconds
// instead of re-deploying, proving, and submitting on chain. It exercises the per-tx read
// (extractDisclosed) directly, the part we iterate on, decoupled from the slow chain e2e.
const here = dirname(fileURLToPath(import.meta.url));
const fix = JSON.parse(readFileSync(join(here, 'fixtures/disclosureTxs.json'), 'utf8'));

type Tx = Transaction<SignatureEnabled, Proof, Binding>;

function deserialize(raw: string): Tx {
  return Transaction.deserialize<SignatureEnabled, Proof, Binding>(
    'signature',
    'proof',
    'binding',
    Buffer.from(raw, 'hex')
  );
}

/** Merge the fixtures named by label into one tx, the way the coupler binds a caller-supplied
 *  user tx onto the reveal and the LP's capacity. */
function mergeAll(raws: string[]): Tx {
  return raws.map(deserialize).reduce((acc, tx) => acc.merge(tx));
}

/** One saved coupling. Each names the coupler it settled against, so a fixture from any run can
 *  live here and a test selects the ones it needs. */
interface Fixture {
  label: string;
  couplerAddress: string;
  txId: string;
  raw: string;
  expectedS?: string;
  expectedHsp?: string;
  note?: string;
}

const fixtures: Fixture[] = fix.couplings;
const byLabel = (label: string): Fixture => {
  const found = fixtures.find((f) => f.label === label);
  if (!found) {
    throw new Error(`no fixture labelled ${label}`);
  }
  return found;
};
/** Every fixture settled against the same coupler, which is what a merge needs: the reader keeps
 *  only calls matching one address and drops the rest without saying so. */
const sameCoupler = (address: string): Fixture[] => fixtures.filter((f) => f.couplerAddress === address);

const HAPPY = byLabel('coupling1').couplerAddress;
const allFixtures = sameCoupler(HAPPY);
const pair = [byLabel('coupling2'), byLabel('coupling3')];

function couplerCalls(tx: Tx, entryPoint: string): ContractCall<Proof>[] {
  return [...(tx.intents?.values() ?? [])]
    .flatMap((intent) => intent.actions)
    .filter((action): action is ContractCall<Proof> => 'guaranteedTranscript' in action)
    .filter((call) => call.address === HAPPY)
    .filter(
      (call) =>
        (typeof call.entryPoint === 'string' ? call.entryPoint : new TextDecoder().decode(call.entryPoint)) ===
        entryPoint
    );
}

function ok(tx: Tx, couplerAddress: string = HAPPY): Disclosure[] {
  const result = extractDisclosed(tx, couplerAddress);
  if (!result.ok) {
    throw new Error(`expected couplings, got ${JSON.stringify(result.error)}`);
  }
  return result.couplings;
}

const bySecret = (couplings: Disclosure[]): Map<string, Disclosure> =>
  new Map(couplings.map((c) => [uint8ArrayToHex(c.s), c]));

describe('extractDisclosed: per-tx s and hsp from each mintReveal transcript', () => {
  for (const c of fixtures) {
    it(`recovers s and hsp for ${c.label}`, () => {
      const couplings = ok(deserialize(c.raw), c.couplerAddress);
      expect(couplings).toHaveLength(1);
      expect(uint8ArrayToHex(couplings[0].s)).toBe(c.expectedS);
      expect(uint8ArrayToHex(couplings[0].hsp)).toBe(c.expectedHsp);
    });
  }

  it('names each coupling by the token its own reveal minted', () => {
    const [coupling] = ok(deserialize(byLabel('coupling1').raw));
    const h = persistentHash(new CompactTypeBytes(32), coupling.s);
    expect(coupling.domainSep).toEqual(couplingDomainSep(h, coupling.hsp));
    expect(coupling.tokenColor).toBe(rawTokenType(coupling.domainSep, HAPPY));
  });

  it('recovers DISTINCT s and hsp for two separate reveals', () => {
    const [a, b] = pair.map((t: { raw: string }) => ok(deserialize(t.raw))[0]);
    // The live-state read returns last-write-wins (identical) for same-block reveals. The
    // per-tx read returns each tx's own values, so they differ.
    expect(uint8ArrayToHex(a.s)).not.toBe(uint8ArrayToHex(b.s));
    expect(uint8ArrayToHex(a.hsp)).not.toBe(uint8ArrayToHex(b.hsp));
    for (const value of [a, b]) {
      expect(value.s).toHaveLength(32);
      expect(value.hsp).toHaveLength(32);
    }
  });

  it('returns a noMintReveal error, not a throw, for a different coupler address', () => {
    const wrongAddress = '00'.repeat(32);
    const result = extractDisclosed(deserialize(byLabel('coupling1').raw), wrongAddress);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.kind).toBe('noMintReveal');
  });
});

// A merged tx is the normal case, not an exotic one: couple() merges the LP capacity, the
// reveal fragment, and a caller-supplied user tx, and that user tx may itself carry couplings.
describe('extractDisclosed: every coupling in a merged tx', () => {
  it('returns both couplings of a two-way merge, each with its own s and hsp', () => {
    const alone = pair.map((t: { raw: string }) => ok(deserialize(t.raw))[0]);
    const merged = ok(mergeAll(pair.map((t: { raw: string }) => t.raw)));
    expect(merged).toHaveLength(2);
    for (const one of alone) {
      const found = bySecret(merged).get(uint8ArrayToHex(one.s));
      expect(found).toBeDefined();
      expect(found).toEqual(one);
    }
  });

  it('returns every coupling of a three-way merge, each with its own s and hsp', () => {
    const merged = ok(mergeAll(allFixtures.map((t) => t.raw)));
    expect(merged).toHaveLength(allFixtures.length);
    for (const fixture of allFixtures) {
      const one = ok(deserialize(fixture.raw))[0];
      expect(bySecret(merged).get(uint8ArrayToHex(one.s))).toEqual(one);
    }
  });

  it('finds the coupling for one escrow commitment pair among several', () => {
    const couplings = ok(mergeAll(allFixtures.map((t) => t.raw)));
    for (const fixture of allFixtures) {
      const one = ok(deserialize(fixture.raw))[0];
      const h = persistentHash(new CompactTypeBytes(32), one.s);
      expect(findCoupling(couplings, h, one.hsp)).toEqual(one);
    }
    const unknown = new Uint8Array(32).fill(7);
    expect(findCoupling(couplings, unknown, unknown)).toBeUndefined();
  });
});

/** Rebuild a tx around hand-picked coupler calls, keeping the real offer so the transients
 *  still resolve. extractDisclosed reads a transaction structurally, so this exercises shapes
 *  no honest prover would produce, without needing a chain to produce them. */
function txWithCalls(source: Tx, calls: unknown[]): Tx {
  return {
    intents: new Map(calls.map((call, i) => [i + 1, { actions: [call] }])),
    guaranteedOffer: source.guaranteedOffer,
    fallibleOffer: source.fallibleOffer,
  } as unknown as Tx;
}

function bytesAlignment(length: number) {
  return [{ tag: 'atom', value: { tag: 'bytes', length } }];
}

/** Append a synthetic top-level cell write to a reveal's program. Recorded transactions can
 *  never carry these shapes, because an honest prover does not emit them, so the guards that
 *  reject them are only reachable from a hand-built transcript. */
function withExtraWrite(call: ContractCall<Proof>, key: unknown, value: Uint8Array, arity = 1, declared = 32): unknown {
  const transcript = call.guaranteedTranscript;
  const program = [
    ...(transcript?.program ?? []),
    { push: { storage: false, value: { tag: 'cell', content: { value: key, alignment: bytesAlignment(1) } } } },
    {
      push: {
        storage: true,
        value: { tag: 'cell', content: { value: [value], alignment: bytesAlignment(declared) } },
      },
    },
    { ins: { cached: false, n: arity } },
  ];
  return {
    address: call.address,
    entryPoint: call.entryPoint,
    guaranteedTranscript: { ...transcript, program },
    fallibleTranscript: call.fallibleTranscript,
  };
}

/** The same reveal, but the token it claims to have minted differs from the real one only in
 *  its LAST hex character. A comparison that stops early cannot tell this from an honest reveal. */
function nearMissMint(call: ContractCall<Proof>): unknown {
  const transcript = call.guaranteedTranscript;
  const real = [...(transcript?.effects.shieldedMints.keys() ?? [])];
  expect(real).toHaveLength(1);
  const last = real[0].slice(-1);
  const nudged = real[0].slice(0, -1) + (last === '0' ? '1' : '0');
  return {
    address: call.address,
    entryPoint: call.entryPoint,
    guaranteedTranscript: {
      ...transcript,
      effects: { ...transcript?.effects, shieldedMints: new Map([[nudged, 1n]]) },
    },
    fallibleTranscript: call.fallibleTranscript,
  };
}

/** A reveal that cannot be read at all: touching its program throws. Deliberately not tied to
 *  any one unguarded helper, so the test pins the isolation property rather than today's bug. */
function hostileReveal(call: ContractCall<Proof>): unknown {
  return {
    address: call.address,
    entryPoint: call.entryPoint,
    get guaranteedTranscript(): never {
      throw new Error('transcript unreadable');
    },
    fallibleTranscript: call.fallibleTranscript,
  };
}

/** Swap the two arity-1 cell writes' values, the shape a contract field reorder produces:
 *  both slots are still written, so only recomputing the minted token catches it. */
function swapDisclosedCells(call: ContractCall<Proof>): unknown {
  const program: Op<AlignedValue>[] = [...(call.guaranteedTranscript?.program ?? [])];
  const writes = program.flatMap((op, i) => (typeof op === 'object' && 'ins' in op && op.ins.n === 1 ? [i] : []));
  expect(writes).toHaveLength(2);
  const [a, b] = writes;
  [program[a - 1], program[b - 1]] = [program[b - 1], program[a - 1]];
  return {
    address: call.address,
    entryPoint: call.entryPoint,
    guaranteedTranscript: { ...call.guaranteedTranscript, program },
    fallibleTranscript: call.fallibleTranscript,
  };
}

describe('extractDisclosed: one bad reveal does not sink the others', () => {
  // A tx can settle several couplings, and the reveals in it come from different parties. A
  // malformed one must not cost an honest party the secret it is entitled to read, otherwise
  // anyone who can get a reveal into a tx can deny everyone else in it.
  it('returns the honest coupling and reports the malformed one alongside it', () => {
    const a = deserialize(pair[0].raw);
    const b = deserialize(pair[1].raw);
    const [revealA] = couplerCalls(a, 'mintReveal');
    const [revealB] = couplerCalls(b, 'mintReveal');
    const tx = txWithCalls(a, [revealA, swapDisclosedCells(revealB)]);

    const result = extractDisclosed(tx, HAPPY);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.couplings).toHaveLength(1);
    expect(uint8ArrayToHex(result.couplings[0].s)).toBe(uint8ArrayToHex(ok(a)[0].s));
    expect(result.skipped.map((e) => e.kind)).toEqual(['domainSepMismatch']);
  });

  // The other way a reveal can be bad: not merely wrong, but malformed enough that reading it
  // THROWS. A predicate failure and a thrown error must cost the same, one reveal, or anyone
  // who can get a reveal into a tx can deny everyone else in it by crashing the decoder.
  it('returns the honest coupling when reading another reveal throws', () => {
    const a = deserialize(pair[0].raw);
    const [revealA] = couplerCalls(a, 'mintReveal');
    const tx = txWithCalls(a, [revealA, hostileReveal(revealA)]);

    const result = extractDisclosed(tx, HAPPY);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(uint8ArrayToHex(result.couplings[0].s)).toBe(uint8ArrayToHex(ok(a)[0].s));
    expect(result.skipped.map((e) => e.kind)).toEqual(['decodeFailed']);
  });

  it('survives the throwing reveal coming first', () => {
    const a = deserialize(pair[0].raw);
    const [revealA] = couplerCalls(a, 'mintReveal');
    const tx = txWithCalls(a, [hostileReveal(revealA), revealA]);

    const result = extractDisclosed(tx, HAPPY);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(uint8ArrayToHex(result.couplings[0].s)).toBe(uint8ArrayToHex(ok(a)[0].s));
  });

  // Order must not decide who is readable.
  it('survives the malformed reveal coming first', () => {
    const a = deserialize(pair[0].raw);
    const b = deserialize(pair[1].raw);
    const [revealA] = couplerCalls(a, 'mintReveal');
    const [revealB] = couplerCalls(b, 'mintReveal');
    const tx = txWithCalls(a, [swapDisclosedCells(revealB), revealA]);

    const result = extractDisclosed(tx, HAPPY);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(uint8ArrayToHex(result.couplings[0].s)).toBe(uint8ArrayToHex(ok(a)[0].s));
    expect(result.skipped).toHaveLength(1);
  });

  // Every reveal being unreadable is a different situation from some being unreadable, and the
  // caller should not have to inspect an empty list to notice.
  it('fails when no reveal survives', () => {
    const tx = deserialize(byLabel('coupling1').raw);
    const [reveal] = couplerCalls(tx, 'mintReveal');
    const result = extractDisclosed(txWithCalls(tx, [swapDisclosedCells(reveal)]), HAPPY);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.kind).toBe('domainSepMismatch');
  });

  it('reports nothing skipped when every reveal is honest', () => {
    const result = extractDisclosed(mergeAll([pair[0].raw, pair[1].raw]), HAPPY);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.couplings).toHaveLength(2);
    expect(result.skipped).toEqual([]);
  });
});

describe('cellWritesBySlot ignores writes that are not top-level disclosure slots', () => {
  const revealOf = (raw: string): ContractCall<Proof> => couplerCalls(deserialize(raw), 'mintReveal')[0];

  // Each case appends a write AIMED AT SLOT 0, the slot holding s, that one guard rejects. If
  // that guard were dropped the write would land and corrupt the secret, so these pin the
  // guards rather than merely showing an unrelated write is harmless.
  const stillReadsRealSecret = (call: unknown): void => {
    const tx = deserialize(byLabel('coupling1').raw);
    const result = extractDisclosed(txWithCalls(tx, [call]), HAPPY);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(uint8ArrayToHex(result.couplings[0].s)).toBe(byLabel('coupling1').expectedS);
  };

  const SLOT_0 = [new Uint8Array([])];
  const DECOY = new Uint8Array(32).fill(9);

  // Higher arity means a write INTO a container, not a slot of its own.
  it('a container insert aimed at slot 0 does not overwrite the secret', () => {
    stillReadsRealSecret(withExtraWrite(revealOf(byLabel('coupling1').raw), SLOT_0, DECOY, 2));
  });

  // A map key is one 32-byte cell, not a slot index, so it must not resolve to a slot at all.
  it('a 32-byte map key is not read as a slot index', () => {
    stillReadsRealSecret(withExtraWrite(revealOf(byLabel('coupling1').raw), [new Uint8Array(32).fill(0)], DECOY));
  });

  // A contract that grows another stored field must stay readable.
  it('a genuine third slot does not disturb the read', () => {
    stillReadsRealSecret(withExtraWrite(revealOf(byLabel('coupling1').raw), [new Uint8Array([2])], DECOY));
  });

  // Losing a slot we DO need is still a hard failure, since nothing can be verified without it.
  it('reports unexpectedSlots when a disclosure slot is missing', () => {
    const tx = deserialize(byLabel('coupling1').raw);
    const reveal = revealOf(byLabel('coupling1').raw);
    const program = (reveal.guaranteedTranscript?.program ?? []).slice(3);
    const truncated = {
      address: reveal.address,
      entryPoint: reveal.entryPoint,
      guaranteedTranscript: { ...reveal.guaranteedTranscript, program },
      fallibleTranscript: reveal.fallibleTranscript,
    };
    const result = extractDisclosed(txWithCalls(tx, [truncated]), HAPPY);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.kind).toBe('unexpectedSlots');
  });
});

describe('the verification compares whole values, not prefixes', () => {
  // The domainSep check is the only thing standing between a contract field reorder and a
  // silently swapped secret. A comparison that stops early would accept a wrong token, and
  // every other negative case here differs in its first byte, so nothing would notice.
  it('rejects a reveal whose minted token differs only in the last character', () => {
    const tx = deserialize(byLabel('coupling1').raw);
    const [reveal] = couplerCalls(tx, 'mintReveal');
    const result = extractDisclosed(txWithCalls(tx, [nearMissMint(reveal)]), HAPPY);

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.kind).toBe('domainSepMismatch');
    if (result.error.kind !== 'domainSepMismatch') {
      return;
    }
    // The two must share everything but the final character, otherwise this proves nothing.
    expect(result.error.minted[0].slice(0, -1)).toBe(result.error.expected.slice(0, -1));
    expect(result.error.minted[0]).not.toBe(result.error.expected);
  });

  // findCoupling derives the separator by hashing the pair it is given, so a caller cannot
  // supply commitments that land a near-miss without a partial hash collision. The reachable
  // failure is the ordinary one: a real escrow that this tx does not settle.
  it('findCoupling returns undefined for a commitment pair this tx does not settle', () => {
    const couplings = ok(mergeAll(pair.map((t: { raw: string }) => t.raw)));
    const other = ok(deserialize(byLabel('coupling1').raw))[0];

    // couplings[0] is a real coupling, and it is not one of the two that were merged.
    const h = persistentHash(new CompactTypeBytes(32), other.s);
    expect(findCoupling(couplings, h, other.hsp)).toBeUndefined();

    // ... and each merged coupling still resolves to itself, so the miss is not blanket.
    for (const coupling of couplings) {
      const own = persistentHash(new CompactTypeBytes(32), coupling.s);
      expect(findCoupling(couplings, own, coupling.hsp)).toBe(coupling);
    }
  });

  // The commitments above differ from the first character, so a comparison that stopped early
  // would still tell them apart. This is the near miss that one cannot reach: a separator
  // sharing every byte but the last.
  it('findCoupling refuses a separator that matches all but its final byte', () => {
    const real = ok(deserialize(byLabel('coupling1').raw))[0];
    const h = persistentHash(new CompactTypeBytes(32), real.s);
    const wanted = couplingDomainSep(h, real.hsp);

    const nearMiss = Uint8Array.from(wanted);
    nearMiss[nearMiss.length - 1] ^= 0x01;
    expect(uint8ArrayToHex(nearMiss).slice(0, -2)).toBe(uint8ArrayToHex(wanted).slice(0, -2));

    const decoy: Disclosure = { ...real, domainSep: nearMiss };
    expect(findCoupling([decoy], h, real.hsp)).toBeUndefined();
    expect(findCoupling([decoy, real], h, real.hsp)).toBe(real);
  });
});

describe('extractDisclosed: degenerate shapes stay discriminated errors', () => {
  it('rejects a reveal whose disclosed cells do not derive the token it minted', () => {
    const tx = deserialize(byLabel('coupling1').raw);
    const [reveal] = couplerCalls(tx, 'mintReveal');
    const tampered = txWithCalls(tx, [swapDisclosedCells(reveal), ...couplerCalls(tx, 'absorb')]);
    const result = extractDisclosed(tampered, HAPPY);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    // The check is what the old `exactly two slots` heuristic could not do: the swap leaves
    // both slots written, so only the minted token distinguishes it from an honest reveal.
    const honest = uint8ArrayToHex(ok(tx)[0].domainSep);
    expect(result.error).toEqual({
      kind: 'domainSepMismatch',
      expected: expect.not.stringMatching(honest),
      minted: [honest],
    });
  });

  it('returns decodeFailed, not a throw, when the transaction shape is unreadable', () => {
    const broken = {
      get intents(): never {
        throw new Error('intents unavailable');
      },
    } as unknown as Tx;
    const result = extractDisclosed(broken, HAPPY);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.kind).toBe('decodeFailed');
  });
});
