import { describe, it, expect, vi } from 'vitest';
import { MetricsService, type CapacitySource } from './metrics.js';

const gauges = new Map<string, { getValue: () => number; attributes?: Record<string, string> }>();

vi.mock('../meter.js', () => ({
  meterService: {
    gauge: (
      name: string,
      _desc: string,
      getValue: () => number,
      attributes?: Record<string, string>,
    ) => {
      gauges.set(name, { getValue, attributes });
    },
  },
}));

function source(overrides: Partial<CapacitySource> = {}): CapacitySource {
  return {
    available: () => 5000n,
    lockedUtxos: () => ({ count: 1, amount: 500n }),
    totalUtxos: () => 4,
    ...overrides,
  };
}

describe('MetricsService', () => {
  it('reports no capacity when no chain provides any', () => {
    const service = new MetricsService({});
    service.recordRevenue('cardano:ada:', 7n);

    expect(service.getMetrics()).toEqual({
      capacity: [],
      revenue: { byCurrency: { 'cardano:ada:': '7' } },
    });
  });

  it('reports usage and contention per capacity asset', () => {
    const service = new MetricsService({ DUST: source() });
    service.recordCapacityUsage('DUST', 100n);
    service.recordCapacityUsage('DUST', 50n);
    // An asset nobody sells is not reported, even if usage is recorded against it.
    service.recordCapacityUsage('ADA', 1n);

    expect(service.getMetrics().capacity).toEqual([
      {
        asset: 'DUST',
        available: '5000',
        consumedTotal: '150',
        consumedLastHour: '150',
        locksLastHour: 2,
        contention: {
          lockedUtxos: 1,
          totalUtxos: 4,
          lockedAmount: '500',
          ratio: 0.25,
          averageRatioLastHour: 0.25,
        },
      },
    ]);
  });

  it('registers gauges labelled with the asset', () => {
    new MetricsService({ DUST: source() });

    expect(gauges.get('ces.capacity.locked_utxos')?.getValue()).toBe(1);
    expect(gauges.get('ces.capacity.locked_amount')?.getValue()).toBe(500);
    expect(gauges.get('ces.capacity.total_utxos')?.getValue()).toBe(4);
    expect(gauges.get('ces.capacity.available_amount')?.getValue()).toBe(5000);
    expect(gauges.get('ces.capacity.available_amount')?.attributes).toEqual({ asset: 'DUST' });
  });
});
