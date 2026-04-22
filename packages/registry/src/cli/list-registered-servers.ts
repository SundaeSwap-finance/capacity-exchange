import {
  buildNetworkConfig,
  createLogger,
  createPublicDataProvider,
  requireNetworkId,
  resolveEnv,
  runCli,
} from '@sundaeswap/capacity-exchange-nodejs';
import { program } from 'commander';

import { Registry } from '../contract.js';
import { RegistryMapping, registryEntries } from '../types.js';

const logger = createLogger(import.meta);

// TODO: migrate to a shared `withNetworkContext` / `withNetworkContextFromEnv`
// helper once that exists. Building the public data provider inline here keeps
// this read-only CLI from forcing wallet bootstrap via `withAppContextFromEnv`.
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
