import { describe, it, expect, afterEach, vi } from 'vitest';
import { resolveCesUrl } from '../src/wallet/registryLookup';
import { SRV_NAME, makeDohAnswer } from './helpers/srvFixtures';

/** Fetch mock that respects AbortSignal — rejects with AbortError when the signal fires. */
const mockHangingFetch = () =>
  vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => {
    return new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(new DOMException('The operation was aborted.', 'AbortError'));
      });
    });
  });

const mockFetchDoh = (answers: ReturnType<typeof makeDohAnswer>[], status = 0) =>
  vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(JSON.stringify({ Status: status, Answer: answers }), { status: 200 }));

describe('resolveCesUrl', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('racing Cloudflare and Google', () => {
    it('races both Cloudflare and Google DoH providers', () => {
      const fetchSpy = mockFetchDoh([]);

      void resolveCesUrl(SRV_NAME);

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('https://cloudflare-dns.com/dns-query'),
        expect.any(Object)
      );
      expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('https://dns.google/resolve'), expect.any(Object));
    });

    it('returns the result from whichever provider responds first', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
        if (String(url).includes('cloudflare')) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ Status: 0, Answer: [makeDohAnswer(10, 100, 8080, 'ces.preview.sundae.fi.')] }),
              { status: 200 }
            )
          );
        }
        return new Promise(() => {}); // Google hangs
      });

      const result = await resolveCesUrl(SRV_NAME);

      expect(result).toBe('https://ces.preview.sundae.fi:8080');
    });

    it('falls back to the other provider if one fails', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
        if (String(url).includes('cloudflare')) {
          return Promise.reject(new Error('network error'));
        }
        return Promise.resolve(
          new Response(
            JSON.stringify({ Status: 0, Answer: [makeDohAnswer(10, 100, 9000, 'ces.preview.sundae.fi.')] }),
            { status: 200 }
          )
        );
      });

      const result = await resolveCesUrl(SRV_NAME);

      expect(result).toBe('https://ces.preview.sundae.fi:9000');
    });

    it('returns null when both providers fail', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network error'));

      const result = await resolveCesUrl(SRV_NAME);

      expect(result).toBeNull();
    });

    it('returns null when fetch hangs past the 5-second timeout', async () => {
      vi.useFakeTimers();
      mockHangingFetch();

      const promise = resolveCesUrl(SRV_NAME);
      await vi.advanceTimersByTimeAsync(5_001);
      const result = await promise;

      expect(result).toBeNull();
      vi.useRealTimers();
    });
  });

  describe('SRV resolution', () => {
    it('resolves a single SRV record to a URL', async () => {
      mockFetchDoh([makeDohAnswer(10, 100, 8080, 'ces.preview.sundae.fi.')]);

      const result = await resolveCesUrl(SRV_NAME);

      expect(result).toBe('https://ces.preview.sundae.fi:8080');
    });

    it('strips trailing dot from target hostname', async () => {
      mockFetchDoh([makeDohAnswer(10, 100, 443, 'node.example.com.')]);

      const result = await resolveCesUrl(SRV_NAME);

      expect(result).toBe('https://node.example.com:443');
    });

    it('picks the record with lowest priority', async () => {
      mockFetchDoh([
        makeDohAnswer(20, 100, 9001, 'low-priority.example.com.'),
        makeDohAnswer(10, 100, 9000, 'high-priority.example.com.'),
      ]);

      const result = await resolveCesUrl(SRV_NAME);

      expect(result).toBe('https://high-priority.example.com:9000');
    });

    it('picks highest weight when priorities are equal', async () => {
      mockFetchDoh([
        makeDohAnswer(10, 10, 9001, 'low-weight.example.com.'),
        makeDohAnswer(10, 100, 9000, 'high-weight.example.com.'),
      ]);

      const result = await resolveCesUrl(SRV_NAME);

      expect(result).toBe('https://high-weight.example.com:9000');
    });

    it('returns null when Answer is empty', async () => {
      mockFetchDoh([]);

      const result = await resolveCesUrl(SRV_NAME);

      expect(result).toBeNull();
    });

    it('returns null when Status is non-zero (NXDOMAIN etc.)', async () => {
      mockFetchDoh([], 3);

      const result = await resolveCesUrl(SRV_NAME);

      expect(result).toBeNull();
    });

    it('returns null when fetch responds with a non-ok status', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 500 }));

      const result = await resolveCesUrl(SRV_NAME);

      expect(result).toBeNull();
    });

    it('encodes the SRV name in the query string', async () => {
      const fetchSpy = mockFetchDoh([]);

      await resolveCesUrl(SRV_NAME);

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent(`_capacityexchange._tcp.${SRV_NAME}`)),
        expect.any(Object)
      );
    });
  });
});
