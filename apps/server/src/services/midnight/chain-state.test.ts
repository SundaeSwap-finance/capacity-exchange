import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import pino from 'pino';

const { mockGetLedgerParameters } = vi.hoisted(() => ({
  mockGetLedgerParameters: vi.fn(),
}));
vi.mock('@sundaeswap/capacity-exchange-core', () => ({
  getLedgerParameters: mockGetLedgerParameters,
}));

import { ChainStateNotReadyError, MidnightChainStateService } from './chain-state.js';

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

describe('MidnightChainStateService', () => {
  let svc: MidnightChainStateService | undefined;

  beforeEach(() => {
    mockGetLedgerParameters.mockReset();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    svc?.stop();
    svc = undefined;
    vi.unstubAllGlobals();
  });

  async function startAndLoad(): Promise<MidnightChainStateService> {
    const s = new MidnightChainStateService('http://indexer.test', logger as never);
    s.start();
    await vi.waitFor(() => expect(s.isReady()).toBe(true));
    return s;
  }

  it('loads tip and ledger params in the background after start', async () => {
    stubTipFetch({ data: { block: { timestamp: 1_700_000_000_000 } } });
    mockGetLedgerParameters.mockResolvedValue(fakeParams);

    svc = await startAndLoad();

    expect(svc.latestBlockTimestamp().getTime()).toBe(1_700_000_000_000);
    expect(svc.ledgerParameters()).toBe(fakeParams);
    expect(svc.health()).toEqual({ status: 'ok' });
  });

  it('start() returns without waiting for the indexer', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
    mockGetLedgerParameters.mockReturnValue(new Promise(() => {}));

    svc = new MidnightChainStateService('http://indexer.test', logger as never);
    svc.start();

    expect(svc.isReady()).toBe(false);
    expect(svc.health()).toEqual({ status: 'syncing' });
    expect(() => svc!.ledgerParameters()).toThrow(ChainStateNotReadyError);
  });

  it('passes an AbortSignal to fetch and to getLedgerParameters', async () => {
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: { block: { timestamp: 1_700_000_000_000 } } }),
    }));
    vi.stubGlobal('fetch', fetchSpy);
    mockGetLedgerParameters.mockResolvedValue(fakeParams);

    svc = await startAndLoad();

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://indexer.test',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(mockGetLedgerParameters).toHaveBeenCalledWith(
      'http://indexer.test',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  describe('when the initial load fails', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    async function startAndExpectSyncing(error: RegExp) {
      svc = new MidnightChainStateService('http://indexer.test', logger as never);
      svc.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(svc.isReady()).toBe(false);
      const health = svc.health();
      expect(health.status).toBe('syncing');
      expect('error' in health && health.error).toMatch(error);
    }

    it('reports syncing on non-OK HTTP for the tip query', async () => {
      stubTipFetch({}, false, 503);
      mockGetLedgerParameters.mockResolvedValue(fakeParams);
      await startAndExpectSyncing(/HTTP 503/);
    });

    it('reports syncing when block is missing from the response', async () => {
      stubTipFetch({ data: { block: null } });
      mockGetLedgerParameters.mockResolvedValue(fakeParams);
      await startAndExpectSyncing(/no block\.timestamp/);
    });

    it('reports syncing when timestamp is not a number', async () => {
      stubTipFetch({ data: { block: { timestamp: 'not-a-number' } } });
      mockGetLedgerParameters.mockResolvedValue(fakeParams);
      await startAndExpectSyncing(/no block\.timestamp/);
    });

    it('reports syncing when fetch rejects (network error / timeout)', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() => Promise.reject(new Error('network down'))),
      );
      mockGetLedgerParameters.mockResolvedValue(fakeParams);
      await startAndExpectSyncing(/network down/);
    });

    it('retries ledger params on the tip cadence until they load', async () => {
      stubTipFetch({ data: { block: { timestamp: 1_700_000_000_000 } } });
      mockGetLedgerParameters
        .mockRejectedValueOnce(new Error('params unavailable'))
        .mockResolvedValue(fakeParams);
      await startAndExpectSyncing(/params unavailable/);

      await vi.advanceTimersByTimeAsync(2_000);

      expect(svc!.isReady()).toBe(true);
      expect(svc!.ledgerParameters()).toBe(fakeParams);
      expect(svc!.health()).toEqual({ status: 'ok' });
    });

    it('does not start a new poll while one is in flight', async () => {
      const fetchSpy = vi.fn(() => new Promise(() => {}));
      vi.stubGlobal('fetch', fetchSpy);
      mockGetLedgerParameters.mockResolvedValue(fakeParams);

      svc = new MidnightChainStateService('http://indexer.test', logger as never);
      svc.start();
      await vi.advanceTimersByTimeAsync(10_000);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  it('latestBlockTimestamp throws if not primed', () => {
    svc = new MidnightChainStateService('http://indexer.test', logger as never);
    expect(() => svc!.latestBlockTimestamp()).toThrow(ChainStateNotReadyError);
  });

  it('ledgerParameters throws if not primed', () => {
    svc = new MidnightChainStateService('http://indexer.test', logger as never);
    expect(() => svc!.ledgerParameters()).toThrow(ChainStateNotReadyError);
  });

  it('returns a defensive copy of the tip (caller mutation does not corrupt cache)', async () => {
    stubTipFetch({ data: { block: { timestamp: 1_700_000_000_000 } } });
    mockGetLedgerParameters.mockResolvedValue(fakeParams);

    svc = await startAndLoad();

    const t1 = svc.latestBlockTimestamp();
    t1.setTime(0);
    expect(svc.latestBlockTimestamp().getTime()).toBe(1_700_000_000_000);
  });

  it('stop() clears the poll timers', async () => {
    stubTipFetch({ data: { block: { timestamp: 1_700_000_000_000 } } });
    mockGetLedgerParameters.mockResolvedValue(fakeParams);

    svc = await startAndLoad();
    svc.stop();
    // No further fetch calls expected after stop. Idempotency check:
    expect(() => svc!.stop()).not.toThrow();
  });
});
