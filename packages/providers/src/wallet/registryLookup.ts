import dns from 'dns';
import { ledger, registryEntries } from '@sundaeswap/capacity-exchange-registry';
import type { ChainStateProvider } from './chainStateProvider';

export type SrvResolver = (srvName: string) => Promise<string | null>;

/**
 * Resolves an SRV record name to a URL using the Node.js `dns` module.
 * Not browser-compatible — import from `index.browser.ts` to get a version
 * that defaults to {@link createDoHSrvResolver} instead.
 */
export async function resolveSrvToUrl(srvName: string): Promise<string | null> {
  let records;
  try {
    records = await dns.promises.resolveSrv(srvName);
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
  const hostname = name.endsWith('.') ? name.slice(0, -1) : name;
  return `https://${hostname}:${port}`;
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
    entries.filter(({ entry }) => entry.expiry > now).map(({ entry }) => srvResolver(entry.address.address))
  );
  return urls.filter((url): url is string => url !== null);
}
