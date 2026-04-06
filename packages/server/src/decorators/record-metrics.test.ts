import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAdd = vi.fn();
const mockRecord = vi.fn();

vi.mock('../meter.js', () => ({
  meterService: {
    counter: () => () => ({ add: mockAdd }),
    histogram: () => () => ({ record: mockRecord }),
    gauge: () => {},
    getMeter: () => ({
      createCounter: () => ({ add: mockAdd }),
      createHistogram: () => ({ record: mockRecord }),
      createObservableGauge: () => ({ addCallback: () => {} }),
    }),
  },
}));

import { recordDuration, recordCounters } from './record-metrics.js';

beforeEach(() => {
  mockAdd.mockClear();
  mockRecord.mockClear();
});

describe('recordDuration', () => {
  it('records duration to histogram', async () => {
    class Test {
      @recordDuration('test.duration', 'test')
      async doWork() {
        await new Promise((r) => setTimeout(r, 10));
        return 'done';
      }
    }

    const result = await new Test().doWork();
    expect(result).toBe('done');
    expect(mockRecord).toHaveBeenCalledTimes(1);
    expect(mockRecord.mock.calls[0][0]).toBeGreaterThanOrEqual(10);
  });
});

describe('recordCounters', () => {
  it('increments counter when extract returns a value', async () => {
    class Test {
      @recordCounters({
        name: 'test.counter',
        description: 'test',
        extract: (result: any) => (result.status === 'ok' ? { value: 1 } : null),
      })
      async doWork() {
        return { status: 'ok' };
      }
    }

    await new Test().doWork();
    expect(mockAdd).toHaveBeenCalledWith(1, undefined);
  });

  it('skips counter when extract returns null', async () => {
    class Test {
      @recordCounters({
        name: 'test.counter',
        description: 'test',
        extract: (result: any) => (result.status === 'ok' ? { value: 1 } : null),
      })
      async doWork() {
        return { status: 'error' };
      }
    }

    await new Test().doWork();
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('passes attributes to counter', async () => {
    class Test {
      @recordCounters({
        name: 'test.counter',
        description: 'test',
        extract: () => ({ value: 5, attributes: { source: 'built' } }),
      })
      async doWork() {
        return {};
      }
    }

    await new Test().doWork();
    expect(mockAdd).toHaveBeenCalledWith(5, { source: 'built' });
  });

  it('handles multiple counters', async () => {
    class Test {
      @recordCounters(
        { name: 'a', description: 'a', extract: () => ({ value: 1 }) },
        { name: 'b', description: 'b', extract: () => ({ value: 2 }) },
      )
      async doWork() {
        return {};
      }
    }

    await new Test().doWork();
    expect(mockAdd).toHaveBeenCalledTimes(2);
    expect(mockAdd).toHaveBeenCalledWith(1, undefined);
    expect(mockAdd).toHaveBeenCalledWith(2, undefined);
  });

  it('skips some counters when their extract returns null', async () => {
    class Test {
      @recordCounters(
        { name: 'a', description: 'a', extract: () => ({ value: 1 }) },
        { name: 'b', description: 'b', extract: () => null },
      )
      async doWork() {
        return {};
      }
    }

    await new Test().doWork();
    expect(mockAdd).toHaveBeenCalledTimes(1);
    expect(mockAdd).toHaveBeenCalledWith(1, undefined);
  });
});
