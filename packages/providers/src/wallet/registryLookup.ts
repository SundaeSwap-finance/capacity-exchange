import type { ChainStateProvider } from './chainStateProvider';
import { ledger, registryEntries, SRV_SERVICE_PREFIX } from '@sundaeswap/capacity-exchange-registry';

export { SRV_SERVICE_PREFIX };

interface DohSrvRecord {
  data: string; // "priority weight port target"
}

interface DohResponse {
  Status: number;
  Answer?: DohSrvRecord[];
}

const DOH_PROVIDERS = ['https://cloudflare-dns.com/dns-query', 'https://dns.google/resolve'];

/**
 * Queries a single DoH endpoint for the SRV name and returns the best server URL. 
 * Throws if:
 * * the request fails;
 * * the HTTP status is not ok; or 
 * * no usable SRV records are returned 
 * 
 * callers should handle
 * errors via {@link Promise.any}.
 */
async function queryDoH(dohUrl: string, srvName: string): Promise<string> {
  const res = await fetch(`${dohUrl}?name=${encodeURIComponent(srvName)}&type=SRV`);
  if (!res.ok) {
    throw new Error(`DoH request failed: ${res.status}`);
  }

  const response = (await res.json()) as DohResponse;
  if (response.Status !== 0 || !response.Answer || response.Answer.length === 0) {
    throw new Error('No SRV records');
  }

  // Each SRV data field is: "priority weight port target"
  const records = response.Answer.map((r) => {
    const [priority, weight, port, target] = r.data.split(' ');
    return { priority: Number(priority), weight: Number(weight), port: Number(port), target };
  });

  records.sort((a, b) => a.priority - b.priority || b.weight - a.weight);
  const { target, port } = records[0];
  const resolvedHost = target.endsWith('.') ? target.slice(0, -1) : target;
  return `https://${resolvedHost}:${port}`;
}

/**
 * Returns a resolver that races Cloudflare (`https://cloudflare-dns.com/dns-query`)
 * and Google (`https://dns.google/resolve`) DoH endpoints, returning the first
 * successful result. Returns `null` if both fail.
 *
 * The domain name passed to the resolver must have a
 * `_capacityexchange._tcp.<domainname>` SRV record registered.
 *
 * @example
 * const resolver = createDoHSrvResolver();
 * const url = await resolver('example.com'); // looks up _capacityexchange._tcp.example.com
 */
export function createDoHSrvResolver() {
  return async (domainname: string): Promise<string | null> => {
    const srvName = `${SRV_SERVICE_PREFIX}${domainname}`;
    try {
      return await Promise.any(DOH_PROVIDERS.map((url) => queryDoH(url, srvName)));
    } catch {
      return null;
    }
  };
}

/**
 * Queries the on-chain registry contract and returns CES server URLs for
 * non-expired entries. Each registered domain name is resolved via
 * {@link createDoHSrvResolver}.
 *
 * Throws if the contract state cannot be found at `registryAddress`.
 * Entries that fail to resolve are silently omitted from the result.
 */
export async function fetchRegistryCesUrls(
  chainStateProvider: ChainStateProvider,
  registryAddress: string
): Promise<string[]> {
  const contractState = await chainStateProvider.queryContractState(registryAddress);
  if (!contractState) {
    throw new Error(`No contract state found at registry address ${registryAddress}`);
  }

  const resolver = createDoHSrvResolver();
  const ledgerState = ledger(contractState.data);
  const entries = registryEntries(ledgerState);
  const now = new Date();
  const urls = await Promise.all(
    entries
      .filter(({ entry }) => entry.expiry > now)
      .map(({ entry }) => {
        const domainname = entry.address.startsWith(SRV_SERVICE_PREFIX)
          ? entry.address.slice(SRV_SERVICE_PREFIX.length)
          : entry.address;
        return resolver(domainname);
      })
  );
  return urls.filter((url): url is string => url !== null);
}
