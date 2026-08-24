import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { uint8ArrayToHex } from '@sundaeswap/capacity-exchange-core';
import { readDisclosureAtTx } from '../src/lib/disclosure.js';

const here = dirname(fileURLToPath(import.meta.url));
const fix = JSON.parse(readFileSync(join(here, 'fixtures/disclosureTxs.json'), 'utf8'));

const INDEXER = 'http://indexer.test/graphql';
const TX_ID = 'abc123';

function stubIndexer(impl: () => Promise<Response> | Response): void {
  global.fetch = vi.fn().mockImplementation(impl);
}

function rowsResponse(rows: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ data: { transactions: rows } }),
  } as Response;
}

afterEach(() => {
  vi.restoreAllMocks();
});

// readDisclosureAtTx promises a discriminated error for every failure. A caller that has to
// wrap it in try/catch cannot branch on `kind`, so a throw escaping here is the actual defect.
describe('readDisclosureAtTx turns every failure into a result, never a throw', () => {
  it('reports txUnavailable when the indexer is unreachable', async () => {
    stubIndexer(() => Promise.reject(new Error('connect ECONNREFUSED 127.0.0.1:8088')));
    const result = await readDisclosureAtTx(INDEXER, fix.couplerAddress, TX_ID);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.kind).toBe('txUnavailable');
  });

  it('reports txUnavailable when the tx is not indexed yet', async () => {
    stubIndexer(() => rowsResponse([]));
    const result = await readDisclosureAtTx(INDEXER, fix.couplerAddress, TX_ID);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.kind).toBe('txUnavailable');
  });

  it('reports txUnavailable for a non-hex txId, without issuing a request', async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;
    const result = await readDisclosureAtTx(INDEXER, fix.couplerAddress, 'not-hex');
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.kind).toBe('txUnavailable');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reports decodeFailed when the raw bytes are not a transaction', async () => {
    stubIndexer(() => rowsResponse([{ raw: 'deadbeef' }]));
    const result = await readDisclosureAtTx(INDEXER, fix.couplerAddress, TX_ID);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.kind).toBe('decodeFailed');
  });

  // Asserting only `ok` says the path did not error, not that it recovered anything real:
  // a stubbed return of 32 zero bytes satisfies it. This is the only test of the assembled
  // path (fetch, hex-decode, deserialize, extract), so it has to check the values.
  it('recovers the real s and hsp end to end, not merely an ok result', async () => {
    const c = fix.couplings[0];
    stubIndexer(() => rowsResponse([{ raw: c.raw }]));
    const result = await readDisclosureAtTx(INDEXER, fix.couplerAddress, TX_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.couplings).toHaveLength(1);
    expect(uint8ArrayToHex(result.couplings[0].s)).toBe(c.expectedS);
    expect(uint8ArrayToHex(result.couplings[0].hsp)).toBe(c.expectedHsp);
  });
});
