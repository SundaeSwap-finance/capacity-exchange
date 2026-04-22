import {
  buildNetworkConfig,
  createLogger,
  createPublicDataProvider,
  requireNetworkId,
  resolveEnv,
  runCli,
} from '@sundaeswap/capacity-exchange-nodejs';
import type { PublicDataProvider } from '@midnight-ntwrk/midnight-js-types';
import { program } from 'commander';

import { Registry } from '../contract.js';
import { RegistryMapping, registryEntries } from '../types.js';

const logger = createLogger(import.meta);

async function listRegisteredServers(
  publicDataProvider: PublicDataProvider,
  contractAddress: string
): Promise<RegistryMapping> {
  logger.info(`Querying registered servers from registry ${contractAddress}...`);

  const contractState = await publicDataProvider.queryContractState(contractAddress);
  if (!contractState) {
    throw new Error(`Contract not found at address: ${contractAddress}`);
  }

  const ledgerState = Registry.ledger(contractState.data);
  const entries: RegistryMapping = new Map();
  for (const { key, entry } of registryEntries(ledgerState)) {
    const keyHex = Buffer.from(key).toString('hex');
    entries.set(keyHex, entry);
  }

  return entries;
}

// TODO: migrate to a shared `withNetworkContext` helper.
async function main(): Promise<void> {
  program
    .name('list-servers')
    .description('Lists registered servers in the registry contract')
    .argument('<contractAddress>', 'address of the registry contract')
    .parse();

  const networkId = requireNetworkId();
  const [contractAddress] = program.args;

  const network = buildNetworkConfig(networkId, resolveEnv());
  const publicDataProvider = createPublicDataProvider(network);

  const entries = await listRegisteredServers(publicDataProvider, contractAddress);

  for (const [key, entry] of entries) {
    const details = {
      ip: entry.ip,
      port: entry.port,
      expiry: entry.expiry.toISOString(),
    };
    console.log(`${key}: ${JSON.stringify(details, null, 2)},`);
  }
}

runCli(main);
