import { metrics, type Meter, type Counter, type Histogram } from '@opentelemetry/api';

/** Lazy meter and instrument factory. */
class MeterService {
  private meter?: Meter;

  constructor(private readonly name: string) {}

  getMeter(): Meter {
    return (this.meter ??= metrics.getMeter(this.name));
  }

  counter(name: string, description: string): () => Counter {
    let c: Counter | undefined;
    return () => (c ??= this.getMeter().createCounter(name, { description }));
  }

  histogram(name: string, description: string): () => Histogram {
    let h: Histogram | undefined;
    return () => (h ??= this.getMeter().createHistogram(name, { description, unit: 'ms' }));
  }
}

export const meterService = new MeterService('capacity-exchange-server');
