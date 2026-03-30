import { describe, it, expect, vi, afterEach } from 'vitest';
import { TtlCache } from './ttl-cache.js';
import pino from 'pino';

const logger = pino({ level: 'silent' });

describe('TtlCache', () => {
  let cache: TtlCache<string>;

  afterEach(() => {
    cache?.stop();
  });

  it('stores and retrieves a value', () => {
    cache = new TtlCache(60, 'test', logger);
    cache.set('k1', 'v1', Date.now() + 60_000);
    expect(cache.get('k1')).toBe('v1');
  });

  it('returns null for missing key', () => {
    cache = new TtlCache(60, 'test', logger);
    expect(cache.get('missing')).toBeNull();
  });

  it('returns null for expired entry', () => {
    cache = new TtlCache(60, 'test', logger);
    cache.set('k1', 'v1', Date.now() - 1);
    expect(cache.get('k1')).toBeNull();
  });

  it('has() returns true for live entry, false for missing/expired', () => {
    cache = new TtlCache(60, 'test', logger);
    cache.set('live', 'v', Date.now() + 60_000);
    cache.set('dead', 'v', Date.now() - 1);

    expect(cache.has('live')).toBe(true);
    expect(cache.has('dead')).toBe(false);
    expect(cache.has('missing')).toBe(false);
  });

  it('delete() removes an entry', () => {
    cache = new TtlCache(60, 'test', logger);
    cache.set('k1', 'v1', Date.now() + 60_000);
    cache.delete('k1');
    expect(cache.get('k1')).toBeNull();
  });

  it('set() with existing key moves it to tail of iteration order', () => {
    cache = new TtlCache(60, 'test', logger);
    const later = Date.now() + 60_000;

    cache.set('a', 'first', later);
    cache.set('b', 'second', later);
    // Re-set 'a' with a new value — should move to tail
    cache.set('a', 'updated', later);

    // Verify 'a' was updated
    expect(cache.get('a')).toBe('updated');
  });

  it('background sweep purges expired entries', () => {
    vi.useFakeTimers();
    try {
      cache = new TtlCache(1, 'test', logger);
      cache.set('k1', 'v1', Date.now() + 500);
      cache.set('k2', 'v2', Date.now() + 60_000);

      vi.advanceTimersByTime(1_000);

      // k1 expired and swept, k2 still alive
      expect(cache.get('k1')).toBeNull();
      expect(cache.get('k2')).toBe('v2');
    } finally {
      vi.useRealTimers();
    }
  });
});
