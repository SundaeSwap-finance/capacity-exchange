import type { ChainStateProvider } from './chainStateProvider';
import { ledger, registryEntries, toSrvName, type DomainName } from '@sundaeswap/capacity-exchange-registry';

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
 * Queries a single DoH endpoint for an SRV record and returns server URL as `https://<target>:<port>`.
 *
 * Throws if:
 * - the request times out (after {@link DOH_TIMEOUT_MS} ms) or fails at the network level;
 * - the HTTP response status is not 2xx;
 * - the DNS response status is non-zero (e.g. NXDOMAIN); or
 * - the response contains no SRV records.
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

  // the one with the lowest priority is selected; ties are broken by highest weight.
  records.sort((a, b) => a.priority - b.priority || b.weight - a.weight);
  const { target, port } = records[0];
  const resolvedHost = target.endsWith('.') ? target.slice(0, -1) : target;
  return `https://${resolvedHost}:${port}`;
}

/**
 * Resolves a registered {@link DomainName} to a CES server URL by racing
 * Cloudflare and Google DoH endpoints.
 *
 * @example
 * const url = await resolveCesUrl(toDomainName('example.com'));
 * // resolves _capacityexchange._tcp.example.com → e.g. 'https://ces.example.com:8080'
 */
export function resolveCesUrl(domainName: DomainName): Promise<string | null> {
  // The domain name is looked up as `_capacityexchange._tcp.<domainName>`.
  const srvName = toSrvName(domainName);

  // Race all providers: resolve with the first successful URL, or null if all fail.
  return new Promise<string | null>((resolve) => {
    let remaining = DOH_PROVIDERS.length;
    for (const dohUrl of DOH_PROVIDERS) {
      queryDoH(dohUrl, srvName)
        .then((url) => resolve(url))
        .catch(() => {
          if (--remaining === 0) {
            resolve(null);
          }
        });
    }
  });
}

/**
 * Queries the on-chain registry contract and returns CES server URLs for
 * non-expired entries.
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

  const ledgerState = ledger(contractState.data);
  const entries = registryEntries(ledgerState);
  const now = new Date();
  const urls = await Promise.all(
    entries.filter(({ entry }) => entry.expiry > now).map(({ entry }) => resolveCesUrl(entry.domainName))
  );
  return urls.filter((url): url is string => url !== null);
}
