import { ledger, registryEntries, type Host } from '@sundaeswap/capacity-exchange-registry';
import type { ChainStateProvider } from './chainStateProvider';

function formatHost(host: Host): string {
  if (host.kind === 'ipv6') {
    return `[${host.address}]`;
  }
  return host.address;
}

function entryToUrl(host: Host, port: number): string {
  return `https://${formatHost(host)}:${port}`;
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
  return entries.filter(({ entry }) => entry.expiry > now).map(({ entry }) => entryToUrl(entry.host, entry.port));
}
