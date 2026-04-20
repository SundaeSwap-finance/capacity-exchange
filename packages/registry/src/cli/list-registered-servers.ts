import {
  AppContext,
  buildProviders,
  createLogger,
  requireNetworkId,
  runCli,
  withAppContext,
} from '@sundaeswap/capacity-exchange-nodejs';
import { program } from 'commander';

import { getContractOutDir, Registry } from '../contract.js';
import { RegistryMapping, registryEntries } from '../types.js';

const logger = createLogger(import.meta);

async function listRegisteredServers(ctx: AppContext, contractAddress: string): Promise<RegistryMapping> {
  logger.info(`Querying registered servers from registry ${contractAddress}...`);

  const contractOutDir = getContractOutDir(logger);
  const providers = buildProviders(ctx, contractOutDir);
  const contractState = await providers.publicDataProvider.queryContractState(contractAddress);
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

async function main(): Promise<void> {
  program
    .name('list-servers')
    .description('Lists registered servers in the registry contract')
    .argument('<contractAddress>', 'address of the registry contract')
    .parse();

  const networkId = requireNetworkId();
  const [contractAddress] = program.args;

  const entries = await withAppContext(networkId, (ctx) => listRegisteredServers(ctx, contractAddress));

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
