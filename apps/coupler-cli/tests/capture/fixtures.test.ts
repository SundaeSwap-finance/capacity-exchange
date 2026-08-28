import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { buildFixture, mergeFixture } from '../../src/capture/fixtures.js';

const here = dirname(fileURLToPath(import.meta.url));
const committed = JSON.parse(
  readFileSync(join(here, '../../../../packages/coupler/tests/fixtures/disclosureTxs.json'), 'utf8')
);

const disclosure = (s: string, hsp: string) => ({
  s: Uint8Array.from(Buffer.from(s.repeat(32), 'hex')),
  hsp: Uint8Array.from(Buffer.from(hsp.repeat(32), 'hex')),
  domainSep: new Uint8Array(32),
  tokenColor: 'c',
});

const built = () =>
  buildFixture('coupler-1', [
    { txId: 'tx1', raw: 'aa', disclosure: disclosure('11', '22') },
    { txId: 'tx2', raw: 'bb', disclosure: disclosure('33', '44') },
  ]);

// The old capture wrote a key nothing read, so a captured file loaded as empty and every
// fixture-backed test failed. Pinning against the committed file is what catches that.
describe('a captured fixture matches what the tests read', () => {
  it('uses the same keys as the committed fixture', () => {
    const f = built();
    expect(Object.keys(f).sort()).toEqual(Object.keys(committed).sort());
    expect(Object.keys(f.couplings[0]).sort()).toEqual(Object.keys(committed.couplings[0]).sort());
  });

  it('writes the disclosed values as hex, as the committed fixture does', () => {
    const f = built();
    expect(f.couplings[0].expectedS).toBe('11'.repeat(32));
    expect(f.couplings[0].expectedHsp).toBe('22'.repeat(32));
    expect(committed.couplings[0].expectedS).toMatch(/^[0-9a-f]{64}$/);
  });

  it('labels each coupling by its position in the file', () => {
    expect(built().couplings.map((c) => c.label)).toEqual(['coupling1', 'coupling2']);
  });
});

// Three entries need two runs, and each entry names its own coupler, so a file can hold
// couplings from more than one deployment.
describe('appending a later run to an existing fixture', () => {
  it('continues the labels rather than restarting them', () => {
    const merged = mergeFixture(
      built(),
      buildFixture('coupler-1', [{ txId: 'tx3', raw: 'cc', disclosure: disclosure('55', '66') }])
    );
    expect(merged.couplings.map((c) => c.label)).toEqual(['coupling1', 'coupling2', 'coupling3']);
    expect(merged.couplings).toHaveLength(3);
  });

  // A second deployment is how the trimmed-secret fixture was captured, so refusing one would
  // have made that capture impossible.
  it('keeps a run settled against a different coupler', () => {
    const merged = mergeFixture(
      built(),
      buildFixture('coupler-2', [{ txId: 'tx3', raw: 'cc', disclosure: disclosure('55', '66') }])
    );
    expect(merged.couplings).toHaveLength(3);
    expect(merged.couplings.map((c) => c.couplerAddress)).toEqual(['coupler-1', 'coupler-1', 'coupler-2']);
  });

  // Labels are how tests name the coupling they need, so renumbering on merge would silently
  // repoint every test that asks for one by name.
  it('leaves a label somebody chose alone', () => {
    const named = { ...built(), couplings: [{ ...built().couplings[0], label: 'trimmedS' }] };
    const merged = mergeFixture(
      named,
      buildFixture('coupler-1', [{ txId: 'tx3', raw: 'cc', disclosure: disclosure('55', '66') }])
    );
    expect(merged.couplings.map((c) => c.label)).toEqual(['trimmedS', 'coupling1']);
  });
});
