import { describe, it, expect, afterEach, vi } from 'vitest';
import { queryTxRaw } from '../src/txRaw.js';

const INDEXER = 'http://indexer.test/graphql';
const TX_ID = 'abc123';

/** Stub the one fetch queryTxRaw makes, returning `rows` as the transactions payload. */
function stubRows(rows: unknown): void {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ data: { transactions: rows } }),
  } as Response);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('queryTxRaw rejects a txId it would otherwise interpolate into the query', () => {
  // The txId is substituted into the GraphQL string, so the hex guard is what stops a
  // caller-supplied identifier from closing the quote and appending its own selection.
  // 'abc' is hex but half a byte, so it can never name a real identifier.
  for (const bad of ['" } } #', 'not-hex', 'abc 123', '', 'abc']) {
    it(`refuses ${JSON.stringify(bad)} without issuing a request`, async () => {
      const fetchSpy = vi.fn();
      global.fetch = fetchSpy;
      await expect(queryTxRaw(INDEXER, bad)).rejects.toThrow(/Invalid txId, expected hex/);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  }
});

describe('queryTxRaw will not guess when the row count is not exactly one', () => {
  // Asserting only the return value leaves the function's identity unpinned: querying the
  // wrong indexer, or by the wrong offset key, still yields one row that still deserializes.
  // Fetching a DIFFERENT tx is the failure the per-tx read exists to prevent, so the request
  // itself has to be checked, not just that a request happened.
  it('asks the given indexer for that exact tx, and returns its raw bytes', async () => {
    stubRows([{ raw: 'deadbeef' }]);
    await expect(queryTxRaw(INDEXER, TX_ID)).resolves.toBe('deadbeef');

    const [url, init] = vi.mocked(global.fetch).mock.calls[0];
    expect(url).toBe(INDEXER);
    const { query } = JSON.parse(String(init?.body));
    expect(query).toContain(`identifier: "${TX_ID}"`);
  });

  // Zero rows means not yet indexed, which is a retry, not a decode failure.
  it('throws when the tx is not indexed yet', async () => {
    stubRows([]);
    await expect(queryTxRaw(INDEXER, TX_ID)).rejects.toThrow(/expected one tx .*got 0/);
  });

  it('throws rather than picking one of several rows', async () => {
    stubRows([{ raw: 'aa' }, { raw: 'bb' }]);
    await expect(queryTxRaw(INDEXER, TX_ID)).rejects.toThrow(/expected one tx .*got 2/);
  });

  it('throws when the row carries no raw bytes', async () => {
    stubRows([{}]);
    await expect(queryTxRaw(INDEXER, TX_ID)).rejects.toThrow(/no raw tx/);
  });
});
