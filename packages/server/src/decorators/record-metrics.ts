import { meterService } from '../meter.js';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Records method duration to a histogram. */
export function recordDuration(name: string, description: string) {
  const getHistogram = meterService.histogram(name, description);
  return function (_target: any, _key: string, descriptor: PropertyDescriptor): PropertyDescriptor {
    const original = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      const start = Date.now();
      try {
        return await original.apply(this, args);
      } finally {
        getHistogram().record(Date.now() - start);
      }
    };
    return descriptor;
  };
}

interface CounterSpec {
  name: string;
  description: string;
  extract: (result: any) => { value: number; attributes?: Record<string, string> } | null;
}

/** Increments counters based on the method's return value. */
export function recordCounters(...specs: CounterSpec[]) {
  const counters = specs.map((spec) => ({
    getCounter: meterService.counter(spec.name, spec.description),
    extract: spec.extract,
  }));
  return function (_target: any, _key: string, descriptor: PropertyDescriptor): PropertyDescriptor {
    const original = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      const result = await original.apply(this, args);
      for (const { getCounter, extract } of counters) {
        const extracted = extract(result);
        if (extracted) getCounter().add(extracted.value, extracted.attributes);
      }
      return result;
    };
    return descriptor;
  };
}
