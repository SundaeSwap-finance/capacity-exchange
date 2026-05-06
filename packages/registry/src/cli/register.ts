import { program } from 'commander';
import { type IpAddress, type ServerAddress, type RegistryEntry } from '../types.js';
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

function parseIp(input: string): IpAddress | null {
  if (input.includes(':')) {
    return { kind: 'ipv6', address: input };
  }
  if (IPV4_RE.test(input)) {
    return { kind: 'ipv4', address: input };
  }
  return null;
}

function parseServerAddress(hostStr: string, portArg: string | undefined): ServerAddress {
  const ip = parseIp(hostStr);
  if (ip) {
    if (!portArg) {
      throw new Error('Missing port.');
    }
    const port = Number(portArg);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error(`Invalid port: "${portArg}".`);
    }
    return { kind: 'ip', host: ip, port };
  }
  // Treat as SRV record name
  if (portArg) {
    throw new Error('Port not required for an SRV record.');
  }
  return { kind: 'srv', address: hostStr };
}

async function main(): Promise<TxResult> {
  program
    .name('register')
    .description('Registers a server to the registry contract')
    .argument('<secretKeyFile>', 'registry secret key file')
    .argument('<host>', 'SRV record name (e.g. _ces._tcp.example.com), IPv4, or IPv6 address')
    .argument('[port]', 'server port number (required for IP addresses, not used for SRV)')
    .argument('[period]', 'registration period in days (default: 30 for mainnet, 0.5 for preview/preprod)')
    .argument('[contractAddress]', 'address of the registry contract (defaults to well-known address for network)')
    .parse();

  const networkId = requireEnvVar(resolveEnv(), 'NETWORK_ID');

  const [secretKeyFile, hostStr, portArg, periodArg, contractAddressArg] = program.args;
  const contractAddress = resolveRegistryAddress(networkId, contractAddressArg);

  const secretKey = readSecretKeyFile(secretKeyFile);

  const defaultDays = DEFAULT_PERIOD_DAYS[networkId] ?? 0.5;
  const days = periodArg ? parsePositiveNumber('period', periodArg) : defaultDays;

  const expiry = new Date(Date.now() + days * DAYS_TO_MS);
  console.log(`expiry date: ${expiry}`);

  const address = parseServerAddress(hostStr, portArg);
  const entry: RegistryEntry = { address, expiry };

  return withAppContextFromEnv(networkId, (ctx) =>
    register(ctx, secretKey, {
      contractAddress,
      entry,
    })
  );
}

runCli(main);
