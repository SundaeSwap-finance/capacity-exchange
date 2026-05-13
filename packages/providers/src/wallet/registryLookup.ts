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

const DOH_TIMEOUT_MS = 5_000;

/**
 * Queries a single DoH endpoint for the SRV name and returns the best server URL.
 * Throws if the request fails, times out, the HTTP status is not ok, or no usable
 * SRV records are returned. Callers should handle errors via `Promise.any`.
 */
async function queryDoH(dohUrl: string, srvName: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOH_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${dohUrl}?name=${encodeURIComponent(srvName)}&type=SRV`, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }

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

  // Sort by lowest priority first, then highest weight.
  records.sort((a, b) => a.priority - b.priority || b.weight - a.weight);
  const { target, port } = records[0];
  const resolvedHost = target.endsWith('.') ? target.slice(0, -1) : target;
  return `https://${resolvedHost}:${port}`;
}

/**
 * Returns a resolver that races Cloudflare and Google DoH endpoints, returning
 * the first successful result. Returns `null` if both fail.
 *
 * @example
 * const resolver = createDoHSrvResolver();
 * const url = await resolver('example.com'); // looks up _capacityexchange._tcp.example.com
 */
export function createDoHSrvResolver() {
  return async (domainname: string): Promise<string | null> => {
    const srvName = domainname.startsWith(SRV_SERVICE_PREFIX) ? domainname : `${SRV_SERVICE_PREFIX}${domainname}`;

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
      .map(async ({ entry }) => {
        return await resolver(entry.address);
      })
  );
  return urls.filter((url): url is string => url !== null);
}
