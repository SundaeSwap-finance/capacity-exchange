import { promises as dns } from 'dns';
import { program } from 'commander';
import { type IpAddress, type RegistryEntry } from '../types.js';
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

const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;

async function resolveHost(host: string): Promise<IpAddress> {
  if (host.includes(':')) {
    return { kind: 'ipv6', address: host };
  }
  if (IPV4_RE.test(host)) {
    return { kind: 'ipv4', address: host };
  }
  // Hostname — resolve via DNS
  const { address, family } = await dns.lookup(host);
  console.log(`Resolved ${host} → ${address} (IPv${family})`);
  return family === 6 ? { kind: 'ipv6', address } : { kind: 'ipv4', address };
}

async function main(): Promise<TxResult> {
  program
    .name('register')
    .description('Registers a server to the registry contract')
    .argument('<secretKeyFile>', 'registry secret key file')
    .argument('<host>', 'server IP address or hostname (IPv4, IPv6, or hostname)')
    .argument('<port>', 'server port number')
    .argument('[period]', 'registration period in days (default: 30 for mainnet, 0.5 for preview/preprod)')
    .argument('[contractAddress]', 'address of the registry contract (defaults to well-known address for network)')
    .parse();

  const networkId = requireEnvVar(resolveEnv(), 'NETWORK_ID');

  const [secretKeyFile, hostStr, portStr, periodArg, contractAddressArg] = program.args;
  const contractAddress = resolveRegistryAddress(networkId, contractAddressArg);

  const secretKey = readSecretKeyFile(secretKeyFile);

  const defaultDays = DEFAULT_PERIOD_DAYS[networkId] ?? 0.5;
  const days = periodArg ? parsePositiveNumber('period', periodArg) : defaultDays;

  const expiry = new Date(Date.now() + days * DAYS_TO_MS);
  console.log(`expiry date: ${expiry}`);

  const port = Number(portStr);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port: "${portStr}". Expected integer between 1 - 65535.`);
  }

  const ip = await resolveHost(hostStr);

  const entry: RegistryEntry = { ip, port, expiry };

  return withAppContextFromEnv(networkId, (ctx) =>
    register(ctx, secretKey, {
      contractAddress,
      entry,
    })
  );
}

runCli(main);
