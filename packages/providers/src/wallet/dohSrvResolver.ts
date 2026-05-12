import type { ChainStateProvider } from './chainStateProvider';
import { fetchRegistryCesUrls as _fetchRegistryCesUrls, type SrvResolver } from './registryLookup';

interface DohSrvRecord {
  data: string; // "priority weight port target"
}

interface DohResponse {
  Status: number;
  Answer?: DohSrvRecord[];
}

const DEFAULT_DOH_URL = 'https://cloudflare-dns.com/dns-query';

/**
 * Returns an {@link SrvResolver} that resolves SRV records via DNS-over-HTTPS.
 * Browser-compatible.
 *
 * @param dohUrl - DoH endpoint URL. Defaults to the `DOH_URL` environment
 *   variable, falling back to `https://cloudflare-dns.com/dns-query`.
 *
 * @example
 * const resolver = createDoHSrvResolver();
 */
export type { SrvResolver };

export function createDoHSrvResolver(
  dohUrl = (typeof process !== 'undefined' && process.env.DOH_URL) || DEFAULT_DOH_URL
): SrvResolver {
  return async (srvName: string): Promise<string | null> => {
    let response: DohResponse;
    try {
      const res = await fetch(`${dohUrl}?name=${encodeURIComponent(srvName)}&type=SRV`);
      if (!res.ok) {
        return null;
      }
      response = (await res.json()) as DohResponse;
    } catch {
      return null;
    }

    if (response.Status !== 0 || !response.Answer || response.Answer.length === 0) {
      return null;
    }

    // Each SRV data field is: "priority weight port target"
    const records = response.Answer.map((r) => {
      const [priority, weight, port, target] = r.data.split(' ');
      return { priority: Number(priority), weight: Number(weight), port: Number(port), target };
    });

    records.sort((a, b) => a.priority - b.priority || b.weight - a.weight);
    const { target, port } = records[0];
    const hostname = target.endsWith('.') ? target.slice(0, -1) : target;
    return `https://${hostname}:${port}`;
  };
}

/**
 * Browser-compatible re-export of {@link fetchRegistryCesUrls}.
 * Identical signature, but defaults `srvResolver` to {@link createDoHSrvResolver}
 * (DNS-over-HTTPS via `fetch`) instead of the Node.js `dns` module.
 *
 * Consumers importing from `index.browser.ts` get this version automatically.
 */
export function fetchRegistryCesUrls(
  chainStateProvider: ChainStateProvider,
  registryAddress: string,
  srvResolver: SrvResolver = createDoHSrvResolver()
): Promise<string[]> {
  return _fetchRegistryCesUrls(chainStateProvider, registryAddress, srvResolver);
}
