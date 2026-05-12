import dns from 'dns';
import { ledger, registryEntries, SRV_SERVICE_PREFIX } from '@sundaeswap/capacity-exchange-registry';
import type { ChainStateProvider } from './chainStateProvider';

export { SRV_SERVICE_PREFIX };

/**
 * Resolves a domainname to a CES server URL.
 * The domainname must have a corresponding `_capacityexchange._tcp.<domainname>` SRV record.
 */
export type SrvResolver = (domainname: string) => Promise<string | null>;

/**
 * Resolves a CES server domainname to a URL using the Node.js `dns` module.
 * Not browser-compatible — import from `index.browser.ts` to get a version
 * that defaults to {@link createDoHSrvResolver} instead.
 *
 * The domainname must have a `_capacityexchange._tcp.<domainname>` SRV record registered.
 */
export async function resolveSrvToUrl(domainname: string): Promise<string | null> {
  let records;
  try {
    records = await dns.promises.resolveSrv(`${SRV_SERVICE_PREFIX}${domainname}`);
  } catch {
    return null;
  }
  if (records.length === 0) {
    return null;
  }

  // select record with lowest priority, using highest weight ONLY if
  // priority returns 0.
  records.sort((a, b) => a.priority - b.priority || b.weight - a.weight);
  const { name, port } = records[0];
  const target = name.endsWith('.') ? name.slice(0, -1) : name;
  return `https://${target}:${port}`;
}

/**
 * Queries the on-chain registry contract and returns CES server URLs
 * for entries that haven't expired. Used internally by the SDK when a
 * `chainStateProvider` is supplied and the network has a canonical registry
 * contract address.
 *
 * Defaults to {@link resolveSrvToUrl} (Node.js `dns` module). When importing
 * from `index.browser.ts`, this function is re-exported with
 * {@link createDoHSrvResolver} as the default instead.
 */
export async function fetchRegistryCesUrls(
  chainStateProvider: ChainStateProvider,
  registryAddress: string,
  srvResolver: SrvResolver = resolveSrvToUrl
): Promise<string[]> {
  const contractState = await chainStateProvider.queryContractState(registryAddress);
  if (!contractState) {
    throw new Error(`No contract state found at registry address ${registryAddress}`);
  }

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
        return srvResolver(domainname);
      })
  );
  return urls.filter((url): url is string => url !== null);
}
