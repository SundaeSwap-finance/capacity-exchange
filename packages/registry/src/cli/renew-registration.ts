import { TxResult } from '@sundaeswap/capacity-exchange-core';
import { requireNetworkId, runCli, withAppContext } from '@capacity-exchange/midnight-node';
import { program } from 'commander';
import { renewRegistration } from '../circuits/renew-registration.js';
import { readSecretKeyFile } from '../types.js';

const DAYS_TO_MS = 24 * 60 * 60 * 1000;

function main(): Promise<TxResult> {
  program
    .name('renew-registration')
    .description('Renews the registration of an entry in the registry')
    .argument('<contractAddress>', 'address of the registry contract')
    .argument('<secretKeyFile>', 'registry secret key file')
    .argument('<period>', 'new registration period in days (e.g. 30)')
    .parse();

  const networkId = requireNetworkId();

  const [contractAddress, secretKeyFile, periodArg] = program.args;

  const secretKey = readSecretKeyFile(secretKeyFile);

  const days = Number(periodArg);
  if (!Number.isFinite(days) || days <= 0) {
    throw new Error(`Invalid period: "${periodArg}". Expected a positive number of days.`);
  }

  const expiry = new Date(Date.now() + days * DAYS_TO_MS);
  console.log(`New expiry: ${expiry.toISOString()}`);

  const expiryInt = BigInt(Math.floor(expiry.getTime() / 1000));

  return withAppContext(networkId, (ctx) =>
    renewRegistration(ctx, secretKey, {
      contractAddress,
      expiryInt,
    })
  );
}

runCli(main);
