import { describe, it, expect, afterEach, vi } from 'vitest';
import dns from 'dns';
import { resolveSrvToUrl } from '../src/wallet/registryLookup';
import { SRV_NAME, makeSrvRecord } from './helpers/srvFixtures';

describe('resolveSrvToUrl', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves a single SRV record to a URL', async () => {
    vi.spyOn(dns.promises, 'resolveSrv').mockResolvedValue([makeSrvRecord(10, 100, 8080, 'ces.preview.sundae.fi')]);

    const result = await resolveSrvToUrl(SRV_NAME);

    expect(result).toBe('https://ces.preview.sundae.fi:8080');
  });

  it('strips trailing dot from hostname', async () => {
    vi.spyOn(dns.promises, 'resolveSrv').mockResolvedValue([makeSrvRecord(10, 100, 443, 'ces.preview.sundae.fi.')]);

    const result = await resolveSrvToUrl(SRV_NAME);

    expect(result).toBe('https://ces.preview.sundae.fi:443');
  });

  it('picks the record with lowest priority', async () => {
    vi.spyOn(dns.promises, 'resolveSrv').mockResolvedValue([
      makeSrvRecord(20, 100, 9001, 'low-priority.example.com'),
      makeSrvRecord(10, 100, 9000, 'high-priority.example.com'),
    ]);

    const result = await resolveSrvToUrl(SRV_NAME);

    expect(result).toBe('https://high-priority.example.com:9000');
  });

  it('picks highest weight when priorities are equal', async () => {
    vi.spyOn(dns.promises, 'resolveSrv').mockResolvedValue([
      makeSrvRecord(10, 10, 9001, 'low-weight.example.com'),
      makeSrvRecord(10, 100, 9000, 'high-weight.example.com'),
    ]);

    const result = await resolveSrvToUrl(SRV_NAME);

    expect(result).toBe('https://high-weight.example.com:9000');
  });

  it('returns null when no records are returned', async () => {
    vi.spyOn(dns.promises, 'resolveSrv').mockResolvedValue([]);

    const result = await resolveSrvToUrl(SRV_NAME);

    expect(result).toBeNull();
  });

  it('returns null when dns.promises.resolveSrv throws', async () => {
    vi.spyOn(dns.promises, 'resolveSrv').mockRejectedValue(new Error('ENOTFOUND'));

    const result = await resolveSrvToUrl(SRV_NAME);

    expect(result).toBeNull();
  });
});
