import { describe, it, expect, vi, afterEach } from 'vitest';
import type { ChainStateProvider } from '@sundaeswap/capacity-exchange-providers';
import type { MidnightChainStateService } from '../services/midnight/chain-state.js';
import { peerChainStateProvider } from './peerChainStateProvider.js';

const params = { fake: 'params' } as never;

function indexerProvider(overrides: Partial<ChainStateProvider> = {}): ChainStateProvider {
  return {
    queryContractState: vi.fn(async () => null),
    getLedgerParameters: vi.fn(async () => {
      throw new Error('should not be called');
    }),
    dispose: vi.fn(async () => {}),
    ...overrides,
  };
}

const chainState = { ledgerParameters: () => params } as unknown as MidnightChainStateService;

describe('peerChainStateProvider', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('serves ledger parameters from the cache, not the indexer', async () => {
    const inner = indexerProvider();
    const provider = peerChainStateProvider(inner, chainState);

    await expect(provider.getLedgerParameters()).resolves.toBe(params);
    expect(inner.getLedgerParameters).not.toHaveBeenCalled();
  });

  it('passes through a contract state query that answers in time', async () => {
    const state = { data: 'state' } as never;
    const inner = indexerProvider({ queryContractState: vi.fn(async () => state) });
    const provider = peerChainStateProvider(inner, chainState);

    await expect(provider.queryContractState('addr' as never)).resolves.toBe(state);
  });

  it('rejects a contract state query that hangs past the timeout', async () => {
    vi.useFakeTimers();
    const inner = indexerProvider({
      queryContractState: vi.fn(() => new Promise<never>(() => {})),
    });
    const provider = peerChainStateProvider(inner, chainState, 1_000);

    const result = provider.queryContractState('addr' as never);
    const assertion = expect(result).rejects.toThrow(/timed out after 1000ms/);
    await vi.advanceTimersByTimeAsync(1_000);
    await assertion;
  });
});
