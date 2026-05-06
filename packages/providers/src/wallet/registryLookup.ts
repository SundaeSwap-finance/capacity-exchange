import * as dns from 'dns';
import { ledger, registryEntries, type ServerAddress, type IpAddress } from '@sundaeswap/capacity-exchange-registry';
import type { ChainStateProvider } from './chainStateProvider';

function socketAddressToUrl(host: IpAddress, port: number): string {
  const hostStr = host.kind === 'ipv6' ? `[${host.address}]` : host.address;
  return `https://${hostStr}:${port}`;
}

/**
 * Resolves an SRV record name to a URL by looking up the DNS SRV record.
 * Returns null if no records are found.
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

async function serverAddressToUrl(address: ServerAddress): Promise<string | null> {
  if (address.kind === 'ip') {
    return socketAddressToUrl(address.host, address.port);
  }
  return resolveSrvToUrl(address.address);
}

/**
 * Queries the on-chain registry contract and returns CES server URLs
 * for entries that haven't expired. Used internally by the SDK when a
 * `chainStateProvider` is supplied and the network has a canonical registry
 * contract address.
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
    entries.filter(({ entry }) => entry.expiry > now).map(({ entry }) => serverAddressToUrl(entry.address))
  );
  return urls.filter((url): url is string => url !== null);
}
