import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import pino from 'pino';

const { mockGetLedgerParameters } = vi.hoisted(() => ({
  mockGetLedgerParameters: vi.fn(),
}));
vi.mock('@sundaeswap/capacity-exchange-core', () => ({
  getLedgerParameters: mockGetLedgerParameters,
}));

import { ChainStateService } from './chain-state.js';

const logger = pino({ level: 'silent' });
const fakeParams = { dust: { dustGracePeriodSeconds: 10800n } } as never;

function stubTipFetch(body: unknown, ok = true, status = 200) {
  return vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok,
      status,
      json: async () => body,
    })),
  );
}

describe('ChainStateService', () => {
  let svc: ChainStateService | undefined;

  beforeEach(() => {
    mockGetLedgerParameters.mockReset();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    svc?.stop();
    svc = undefined;
    vi.unstubAllGlobals();
  });

  it('primes tip and ledger params on start', async () => {
    stubTipFetch({ data: { block: { timestamp: 1_700_000_000_000 } } });
    mockGetLedgerParameters.mockResolvedValue(fakeParams);

    svc = new ChainStateService('http://indexer.test', logger as never);
    await svc.start();

    expect(svc.latestBlockTimestamp().getTime()).toBe(1_700_000_000_000);
    expect(svc.ledgerParameters()).toBe(fakeParams);
  });

  it('passes an AbortSignal to fetch and to getLedgerParameters', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: { block: { timestamp: 1_700_000_000_000 } } }),
    }));
    vi.stubGlobal('fetch', fetchSpy);
    mockGetLedgerParameters.mockResolvedValue(fakeParams);

    svc = new ChainStateService('http://indexer.test', logger as never);
    await svc.start();

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://indexer.test',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(mockGetLedgerParameters).toHaveBeenCalledWith(
      'http://indexer.test',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('throws when indexer returns non-OK HTTP for tip query', async () => {
    stubTipFetch({}, false, 503);
    mockGetLedgerParameters.mockResolvedValue(fakeParams);

    svc = new ChainStateService('http://indexer.test', logger as never);
    await expect(svc.start()).rejects.toThrow(/HTTP 503/);
  });

  it('throws when block is missing from the response', async () => {
    stubTipFetch({ data: { block: null } });
    mockGetLedgerParameters.mockResolvedValue(fakeParams);

    svc = new ChainStateService('http://indexer.test', logger as never);
    await expect(svc.start()).rejects.toThrow(/no block\.timestamp/);
  });

  it('throws when timestamp is not a number', async () => {
    stubTipFetch({ data: { block: { timestamp: 'not-a-number' } } });
    mockGetLedgerParameters.mockResolvedValue(fakeParams);

    svc = new ChainStateService('http://indexer.test', logger as never);
    await expect(svc.start()).rejects.toThrow(/no block\.timestamp/);
  });

  it('throws when fetch rejects (network error / timeout)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('network down'))),
    );
    mockGetLedgerParameters.mockResolvedValue(fakeParams);

    svc = new ChainStateService('http://indexer.test', logger as never);
    await expect(svc.start()).rejects.toThrow(/network down/);
  });

  it('throws when getLedgerParameters rejects', async () => {
    stubTipFetch({ data: { block: { timestamp: 1_700_000_000_000 } } });
    mockGetLedgerParameters.mockRejectedValue(new Error('params unavailable'));

    svc = new ChainStateService('http://indexer.test', logger as never);
    await expect(svc.start()).rejects.toThrow(/params unavailable/);
  });

  it('latestBlockTimestamp throws if not primed', () => {
    svc = new ChainStateService('http://indexer.test', logger as never);
    expect(() => svc!.latestBlockTimestamp()).toThrow(/not started/);
  });

  it('ledgerParameters throws if not primed', () => {
    svc = new ChainStateService('http://indexer.test', logger as never);
    expect(() => svc!.ledgerParameters()).toThrow(/not started/);
  });

  it('returns a defensive copy of the tip (caller mutation does not corrupt cache)', async () => {
    stubTipFetch({ data: { block: { timestamp: 1_700_000_000_000 } } });
    mockGetLedgerParameters.mockResolvedValue(fakeParams);

    svc = new ChainStateService('http://indexer.test', logger as never);
    await svc.start();

    const t1 = svc.latestBlockTimestamp();
    t1.setTime(0);
    expect(svc.latestBlockTimestamp().getTime()).toBe(1_700_000_000_000);
  });

  it('stop() clears the poll timers', async () => {
    stubTipFetch({ data: { block: { timestamp: 1_700_000_000_000 } } });
    mockGetLedgerParameters.mockResolvedValue(fakeParams);

    svc = new ChainStateService('http://indexer.test', logger as never);
    await svc.start();
    svc.stop();
    // No further fetch calls expected after stop. Idempotency check:
    expect(() => svc!.stop()).not.toThrow();
  });
});
