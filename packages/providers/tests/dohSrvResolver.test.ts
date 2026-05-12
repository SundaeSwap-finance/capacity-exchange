import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createDoHSrvResolver } from '../src/wallet/dohSrvResolver';
import { SRV_NAME, makeDohAnswer } from './helpers/srvFixtures';

const mockFetchDoh = (answers: ReturnType<typeof makeDohAnswer>[], status = 0) =>
  vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(JSON.stringify({ Status: status, Answer: answers }), { status: 200 }));

describe('createDoHSrvResolver', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  describe('default dohUrl', () => {
    it('uses cloudflare-dns.com when DOH_URL env var is not set', () => {
      vi.stubEnv('DOH_URL', '');
      const fetchSpy = mockFetchDoh([]);

      const resolver = createDoHSrvResolver();
      void resolver(SRV_NAME);

      expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('https://cloudflare-dns.com/dns-query'));
    });

    it('uses DOH_URL env var when set', () => {
      vi.stubEnv('DOH_URL', 'https://dns.google/resolve');
      const fetchSpy = mockFetchDoh([]);

      const resolver = createDoHSrvResolver();
      void resolver(SRV_NAME);

      expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('https://dns.google/resolve'));
    });
  });

  describe('SRV resolution', () => {
    beforeEach(() => {
      vi.stubEnv('DOH_URL', '');
    });

    it('resolves a single SRV record to a URL', async () => {
      mockFetchDoh([makeDohAnswer(10, 100, 8080, 'ces.preview.sundae.fi.')]);

      const result = await createDoHSrvResolver()(SRV_NAME);

      expect(result).toBe('https://ces.preview.sundae.fi:8080');
    });

    it('strips trailing dot from target hostname', async () => {
      mockFetchDoh([makeDohAnswer(10, 100, 443, 'node.example.com.')]);

      const result = await createDoHSrvResolver()(SRV_NAME);

      expect(result).toBe('https://node.example.com:443');
    });

    it('picks the record with lowest priority', async () => {
      mockFetchDoh([
        makeDohAnswer(20, 100, 9001, 'low-priority.example.com.'),
        makeDohAnswer(10, 100, 9000, 'high-priority.example.com.'),
      ]);

      const result = await createDoHSrvResolver()(SRV_NAME);

      expect(result).toBe('https://high-priority.example.com:9000');
    });

    it('picks highest weight when priorities are equal', async () => {
      mockFetchDoh([
        makeDohAnswer(10, 10, 9001, 'low-weight.example.com.'),
        makeDohAnswer(10, 100, 9000, 'high-weight.example.com.'),
      ]);

      const result = await createDoHSrvResolver()(SRV_NAME);

      expect(result).toBe('https://high-weight.example.com:9000');
    });

    it('returns null when Answer is empty', async () => {
      mockFetchDoh([]);

      const result = await createDoHSrvResolver()(SRV_NAME);

      expect(result).toBeNull();
    });

    it('returns null when Status is non-zero (NXDOMAIN etc.)', async () => {
      mockFetchDoh([], 3);

      const result = await createDoHSrvResolver()(SRV_NAME);

      expect(result).toBeNull();
    });

    it('returns null when fetch responds with a non-ok status', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 500 }));

      const result = await createDoHSrvResolver()(SRV_NAME);

      expect(result).toBeNull();
    });

    it('returns null when fetch throws', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network error'));

      const result = await createDoHSrvResolver()(SRV_NAME);

      expect(result).toBeNull();
    });

    it('encodes the SRV name in the query string', async () => {
      const fetchSpy = mockFetchDoh([]);

      await createDoHSrvResolver()(SRV_NAME);

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent(`_capacityexchange._tcp.${SRV_NAME}`))
      );
    });
  });
});
