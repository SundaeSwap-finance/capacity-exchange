import { describe, it, expect, vi } from 'vitest';
import { UtxoService } from './utxo.js';
import type { WalletService } from './wallet.js';
import pino from 'pino';

const gaugeCallbacks = new Map<string, () => number>();

vi.mock('../meter.js', () => ({
  meterService: {
    gauge: (name: string, _desc: string, getValue: () => number) => {
      gaugeCallbacks.set(name, getValue);
    },
    counter: () => () => ({ add: vi.fn() }),
    histogram: () => () => ({ record: vi.fn() }),
    getMeter: () => ({
      createCounter: () => ({ add: vi.fn() }),
      createHistogram: () => ({ record: vi.fn() }),
      createObservableGauge: () => ({ addCallback: () => {} }),
    }),
  },
}));

const logger = pino({ level: 'silent' });

function createMockWalletService(opts: { balance?: bigint; coins?: any[] } = {}) {
  return {
    state: {
      balance: () => opts.balance ?? 0n,
      availableCoinsWithFullInfo: () => opts.coins ?? [],
      state: { state: { syncTime: new Date() } },
    },
    syncState: { status: 'ok' as const },
    spend: vi.fn(),
  } as unknown as WalletService;
}

describe('UtxoService gauges', () => {
  it('registers all four gauges', () => {
    const walletService = createMockWalletService();
    new UtxoService(walletService, logger as any, 60);

    expect(gaugeCallbacks.has('ces.utxo.locked_count')).toBe(true);
    expect(gaugeCallbacks.has('ces.utxo.locked_specks')).toBe(true);
    expect(gaugeCallbacks.has('ces.utxo.total_count')).toBe(true);
    expect(gaugeCallbacks.has('ces.utxo.total_specks')).toBe(true);
  });

  it('reports total count and specks from wallet state', () => {
    const coins = [{}, {}, {}];
    const walletService = createMockWalletService({ balance: 5000n, coins });
    new UtxoService(walletService, logger as any, 60);

    expect(gaugeCallbacks.get('ces.utxo.total_count')!()).toBe(3);
    expect(gaugeCallbacks.get('ces.utxo.total_specks')!()).toBe(5000);
  });

  it('reports zero when wallet state is null', () => {
    const walletService = { state: null, syncState: { status: 'ok' }, spend: vi.fn() } as unknown as WalletService;
    new UtxoService(walletService, logger as any, 60);

    expect(gaugeCallbacks.get('ces.utxo.total_count')!()).toBe(0);
    expect(gaugeCallbacks.get('ces.utxo.total_specks')!()).toBe(0);
  });

  it('reports locked count and specks after locking a utxo', () => {
    const utxo = { generatedNow: 1000n, token: { backingNight: 'abc', mtIndex: 1 } };
    const walletService = createMockWalletService({ balance: 5000n, coins: [utxo] });
    const service = new UtxoService(walletService, logger as any, 60);

    service.lockUtxo(500n);

    expect(gaugeCallbacks.get('ces.utxo.locked_count')!()).toBe(1);
    expect(gaugeCallbacks.get('ces.utxo.locked_specks')!()).toBe(500);
  });
});
