import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Transaction, type SignatureEnabled, type Proof, type Binding } from '@midnight-ntwrk/ledger-v8';
import { hexToBytes } from '@sundaeswap/capacity-exchange-core';
import { extractDisclosed } from '@sundaeswap/capacity-exchange-coupler/operations';
import { captureCoupling, type CaptureDeps } from '../../src/capture/run.js';

const here = dirname(fileURLToPath(import.meta.url));
const fix = JSON.parse(
  readFileSync(join(here, '../../../../packages/coupler/tests/fixtures/disclosureTxs.json'), 'utf8')
);

type Fixture = { label: string; raw: string; couplerAddress: string };
const COUPLER = fix.couplings[0].couplerAddress;
const [A] = fix.couplings.filter((c: Fixture) => c.couplerAddress === COUPLER);
const de = (raw: string) =>
  Transaction.deserialize<SignatureEnabled, Proof, Binding>('signature', 'proof', 'binding', hexToBytes(raw));

/** A chain that hands back the tx it was given, keyed by a content-derived id rather than by
 *  position, so nothing passes by inventing an id. */
function chain(raw: string, over: Partial<CaptureDeps> = {}): CaptureDeps {
  return {
    prepareOne: async () => de(raw),
    submitTx: async (tx) => `tx-${tx.serialize().reduce((h, b) => (h * 31 + b) % 1_000_000_007, 7)}`,
    awaitInclusion: async () => undefined,
    readDisclosure: async (_txId, bound) => extractDisclosed(bound, COUPLER),
    ...over,
  };
}

describe('capturing a coupling for the offline tests', () => {
  it('records the secret the tx actually disclosed', async () => {
    const captured = await captureCoupling(chain(A.raw));
    const disclosed = extractDisclosed(de(A.raw), COUPLER);
    if (!disclosed.ok) {
      throw new Error('fixture did not decode');
    }
    expect(captured.disclosure.s).toEqual(disclosed.couplings[0]!.s);
  });

  // The saved bytes must be the bytes of the tx the id names, or a replay fetches one tx and
  // checks it against another's secret.
  it('pairs the id with the bytes of its own tx', async () => {
    const captured = await captureCoupling(chain(A.raw));
    const replayed = extractDisclosed(de(captured.raw), COUPLER);

    expect(replayed.ok && replayed.couplings[0]!.s).toEqual(captured.disclosure.s);
    expect(captured.txId).toBe(
      `tx-${de(A.raw)
        .serialize()
        .reduce((h, b) => (h * 31 + b) % 1_000_000_007, 7)}`
    );
  });

  // Reads race indexing, so a read issued before the tx lands returns txUnavailable. Capturing
  // must wait, and a failed read must say which tx rather than write a broken entry.
  it('waits for inclusion before reading', async () => {
    let included = false;
    const deps = chain(A.raw, {
      awaitInclusion: async () => {
        included = true;
        return undefined;
      },
      readDisclosure: async (txId, bound) =>
        included ? extractDisclosed(bound, COUPLER) : { ok: false, error: { kind: 'txUnavailable', detail: txId } },
    });

    await expect(captureCoupling(deps)).resolves.toBeDefined();
  });

  it('names the tx when the read fails instead of saving nothing', async () => {
    const deps = chain(A.raw, {
      readDisclosure: async () => ({ ok: false, error: { kind: 'noMintReveal', detail: 'none' } }),
    });

    await expect(captureCoupling(deps)).rejects.toThrow(/did not decode: noMintReveal/);
  });
});
