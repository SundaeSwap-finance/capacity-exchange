import * as fs from 'fs';
import { program } from 'commander';
import { type RegistryEntry } from '../types.js';
import { register } from '../circuits/register.js';
import { requireNetworkId, runCli, withAppContext } from '@capacity-exchange/midnight-node';
import { TxResult } from '@capacity-exchange/midnight-core';

const DAYS_TO_MS = 24 * 60 * 60 * 1000;

function main(): Promise<TxResult> {
  program
    .name('register')
    .description('Registers a server to the registry contract')
    .argument('<contractAddress>', 'address of the registry contract')
    .argument('<secretKeyFile>', 'registry secret key file')
    .argument('<ip>', 'server IP address (IPv4 or IPv6)')
    .argument('<port>', 'server port number')
    .argument('[period]', 'registration period in days (default: 30)', '30')
    .parse();

  const networkId = requireNetworkId();

  const [contractAddress, secretKeyFile, ipStr, portStr, periodArg] = program.args;

  const secretKey = new Uint8Array(Buffer.from(fs.readFileSync(secretKeyFile, 'utf-8').trim(), 'hex'));

  const days = Number(periodArg);
  if (!Number.isFinite(days) || days <= 0) {
    throw new Error(`Invalid period: "${periodArg}". Expected a positive number of days.`);
  }

  const expiry = new Date(Date.now() + days * DAYS_TO_MS);
  console.log(`expiry date: ${expiry}`);

  const entry: RegistryEntry = {
    ip: ipStr.includes(':') ? { kind: 'ipv6', address: ipStr } : { kind: 'ipv4', address: ipStr },
    port: Number(portStr),
    expiry,
  };

  return withAppContext(networkId, (ctx) =>
    register(ctx, secretKey, {
      contractAddress,
      entry,
    })
  );
}

runCli(main);
