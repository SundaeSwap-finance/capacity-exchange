import { parsePositiveNumber, TxResult } from '@sundaeswap/capacity-exchange-core';
import { requireEnvVar, resolveEnv, runCli, withAppContextFromEnv } from '@sundaeswap/capacity-exchange-nodejs';
import { program } from 'commander';
import { renewRegistration } from '../circuits/renew-registration.js';
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
    .name('renew-registration')
    .description('Renews the registration of an entry in the registry')
    .argument('<secretKeyFile>', 'registry secret key file')
    .argument('[period]', 'new registration period in days (default: 30 for mainnet, 0.5 for preview/preprod)')
    .argument('[contractAddress]', 'address of the registry contract (defaults to well-known address for network)')
    .parse();

  const networkId = requireEnvVar(resolveEnv(), 'NETWORK_ID');

  const [secretKeyFile, periodArg, contractAddressArg] = program.args;
  const contractAddress = resolveRegistryAddress(networkId, contractAddressArg);

  const secretKey = readSecretKeyFile(secretKeyFile);

  const defaultDays = DEFAULT_PERIOD_DAYS[networkId] ?? 0.5;
  const days = periodArg ? parsePositiveNumber('period', periodArg) : defaultDays;

  const expiry = new Date(Date.now() + days * DAYS_TO_MS);
  console.log(`New expiry: ${expiry.toISOString()}`);

  const expiryInt = BigInt(Math.floor(expiry.getTime() / 1000));

  return withAppContextFromEnv(networkId, (ctx) =>
    renewRegistration(ctx, secretKey, {
      contractAddress,
      expiryInt,
    })
  );
}

runCli(main);
