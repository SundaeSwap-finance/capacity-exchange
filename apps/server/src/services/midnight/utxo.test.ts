import { describe, it, expect, vi } from 'vitest';
import { MidnightUtxoService } from './utxo.js';
import type { MidnightWalletService } from './wallet.js';
import type { MidnightChainStateService } from './chain-state.js';
import pino from 'pino';

const mockChainStateService = {
  latestBlockTimestamp: () => new Date(),
} as unknown as MidnightChainStateService;

const logger = pino({ level: 'silent' });

function createMockWalletService(opts: { balance?: bigint; coins?: any[] } = {}) {
  return {
    state: {
      capabilities: {
        coinsAndBalances: {
          getAvailableCoins: () => opts.coins ?? [],
        },
      },
      balance: () => opts.balance ?? 0n,
      state: { state: { syncTime: new Date() } },
    },
    syncState: { status: 'ok' as const },
    spend: vi.fn(),
  } as unknown as MidnightWalletService;
}

describe('MidnightUtxoService as a capacity source', () => {
  it('reports total UTXOs and available DUST from wallet state', () => {
    const coins = [{}, {}, {}];
    const walletService = createMockWalletService({ balance: 5000n, coins });
    const service = new MidnightUtxoService(
      walletService,
      mockChainStateService,
      logger as any,
      60,
    );

    expect(service.totalUtxos()).toBe(3);
    expect(service.available()).toBe(5000n);
  });

  it('reports zero when wallet state is null', () => {
    const walletService = {
      state: null,
      syncState: { status: 'ok' },
      spend: vi.fn(),
    } as unknown as MidnightWalletService;
    const service = new MidnightUtxoService(
      walletService,
      mockChainStateService,
      logger as any,
      60,
    );

    expect(service.totalUtxos()).toBe(0);
    expect(service.available()).toBe(0n);
  });

  it('reports locked UTXOs after locking one', () => {
    const utxo = { generatedNow: 1000n, token: { backingNight: 'abc', mtIndex: 1 } };
    const walletService = createMockWalletService({ balance: 5000n, coins: [utxo] });
    const service = new MidnightUtxoService(
      walletService,
      mockChainStateService,
      logger as any,
      60,
    );

    service.lockUtxo(500n);

    expect(service.lockedUtxos()).toEqual({ count: 1, amount: 500n });
  });
});
