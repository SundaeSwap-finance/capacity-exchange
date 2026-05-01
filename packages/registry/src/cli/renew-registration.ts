import { parsePositiveNumber, TxResult } from '@sundaeswap/capacity-exchange-core';
import { requireEnvVar, resolveEnv, runCli, withAppContextFromEnv } from '@sundaeswap/capacity-exchange-nodejs';
import { program } from 'commander';
import { renewRegistration } from '../circuits/renew-registration.js';
import { readSecretKeyFile } from '../utils.js';
import { resolveRegistryAddress } from '../defaultAddresses.js';

const DAYS_TO_MS = 24 * 60 * 60 * 1000;

function main(): Promise<TxResult> {
  program
    .name('renew-registration')
    .description('Renews the registration of an entry in the registry')
    .argument('[contractAddress]', 'address of the registry contract (defaults to well-known address for network)')
    .argument('<secretKeyFile>', 'registry secret key file')
    .argument('<period>', 'new registration period in days (e.g. 30)')
    .parse();

  const networkId = requireEnvVar(resolveEnv(), 'NETWORK_ID');

  const [contractAddressArg, secretKeyFile, periodArg] = program.args;
  const contractAddress = resolveRegistryAddress(networkId, contractAddressArg);

  const secretKey = readSecretKeyFile(secretKeyFile);

  const days = parsePositiveNumber('period', periodArg);

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
