import type { PublicDataProvider } from '@midnight-ntwrk/midnight-js-types';
import { ledger, registryEntries, type IpAddress } from '@capacity-exchange/registry';

function formatIpHost(ip: IpAddress): string {
  if (ip.kind === 'ipv4') {
    return ip.address;
  }
  return `[${ip.address}]`;
}

function entryToUrl(ip: IpAddress, port: number): string {
  return `http://${formatIpHost(ip)}:${port}`;
}

/**
 * Queries the on-chain registry contract and returns CES server URLs
 * for entries that haven't expired. Used internally by the SDK when a
 * `publicDataProvider` is supplied and the network has a canonical registry
 * contract address.
 */
export async function fetchRegistryCesUrls(
  publicDataProvider: PublicDataProvider,
  registryAddress: string
): Promise<string[]> {
  const contractState = await publicDataProvider.queryContractState(registryAddress);
  if (!contractState) {
    return [];
  }

  const ledgerState = ledger(contractState.data);
  const entries = registryEntries(ledgerState);
  const now = new Date();
  return entries.filter(({ entry }) => entry.validTo > now).map(({ entry }) => entryToUrl(entry.ip, entry.port));
}
