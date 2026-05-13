import { program } from 'commander';
import { type RegistryEntry, SRV_SERVICE_PREFIX } from '../types.js';
import { register } from '../circuits/register.js';
import { requireEnvVar, resolveEnv, runCli, withAppContextFromEnv } from '@sundaeswap/capacity-exchange-nodejs';
import { parsePositiveNumber, TxResult } from '@sundaeswap/capacity-exchange-core';
import { readSecretKeyFile } from '../utils.js';
import { resolveRegistryAddress } from '../defaultAddresses.js';

const DAYS_TO_MS = 24 * 60 * 60 * 1000;

const DEFAULT_PERIOD_DAYS: Record<string, number> = {
  mainnet: 30,
  preprod: 0.5,
  preview: 0.5,
};

function main(): Promise<TxResult> {
  program
    .name('register')
    .description('Registers a server to the registry contract')
    .argument('<secretKeyFile>', 'registry secret key file')
    .argument(
      '<domainname>',
      'domain name to register (e.g. example.com) — must have a _capacityexchange._tcp.<domainname> SRV record'
    )
    .argument('[period]', 'registration period in days (default: 30 for mainnet, 0.5 for preview/preprod)')
    .argument('[contractAddress]', 'address of the registry contract (defaults to well-known address for network)')
    .parse();

  const networkId = requireEnvVar(resolveEnv(), 'NETWORK_ID');

  const [secretKeyFile, domainname, periodArg, contractAddressArg] = program.args;
  const srvName = domainname.startsWith(SRV_SERVICE_PREFIX) ? domainname : `${SRV_SERVICE_PREFIX}${domainname}`;

  const contractAddress = resolveRegistryAddress(networkId, contractAddressArg);

  const secretKey = readSecretKeyFile(secretKeyFile);

  const defaultDays = DEFAULT_PERIOD_DAYS[networkId] ?? 0.5;
  const days = periodArg ? parsePositiveNumber('period', periodArg) : defaultDays;

  const expiry = new Date(Date.now() + days * DAYS_TO_MS);
  console.log(`expiry date: ${expiry}`);

  const entry: RegistryEntry = {
    address: srvName,
    expiry,
  };

  return withAppContextFromEnv(networkId, (ctx) =>
    register(ctx, secretKey, {
      contractAddress,
      entry,
    })
  );
}

runCli(main);
