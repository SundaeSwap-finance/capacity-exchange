import { FastifyBaseLogger } from 'fastify';

interface Entry<V> {
  value: V;
  expiresAtMillis: number;
}

/**
 * In-memory cache with a background sweeper.
 */
export class TtlCache<V> {
  private readonly entries = new Map<string, Entry<V>>();
  private readonly sweepInterval: ReturnType<typeof setInterval>;
  private readonly label: string;
  private readonly logger: FastifyBaseLogger;

  constructor(sweepIntervalSeconds: number, label: string, logger: FastifyBaseLogger) {
    this.label = label;
    this.logger = logger;
    this.sweepInterval = setInterval(() => this.purgeExpired(), sweepIntervalSeconds * 1000);
  }

  private purgeExpired(): void {
    const now = Date.now();
    let purged = 0;
    // Iterating over a Map goes in insertion order, so the sweep can stop at the
    // first non-expired entry
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map
    for (const [key, entry] of this.entries) {
      if (now <= entry.expiresAtMillis) {
        break
      };
      this.entries.delete(key);
      purged++;
      this.logger.debug({ key, entry, cache: this.label }, 'Purged expired entry');
    }
    if (purged > 0) {
      this.logger.info({ purged, remaining: this.entries.size, cache: this.label }, 'Purged expired entries');
    }
  }

  stop(): void {
    clearInterval(this.sweepInterval);
  }

  set(key: string, value: V, expiresAtMillis: number): void {
    // Delete-then-insert to keep the key at the tail of iteration order
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAtMillis });
  }

  get(key: string): V | null {
    const entry = this.entries.get(key);
    if (!entry) {
      this.logger.debug({ key, cache: this.label }, 'No entry for key');
      return null;
    }
    if (Date.now() > entry.expiresAtMillis) {
      this.entries.delete(key);
      this.logger.debug({ key, entry, cache: this.label }, 'Entry for key expired');
      return null;
    }
    return entry.value;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

}
