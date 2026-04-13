import * as fs from 'fs';
import * as crypto from 'crypto';
import { program } from 'commander';
import { timestampToDate, type RegistryEntry } from '../types.js';
import { register } from '../circuits/register';
import { requireNetworkId, runCli, withAppContext } from '@capacity-exchange/midnight-node';
import { TxResult } from '@capacity-exchange/midnight-core';

function main(): Promise<TxResult> {
  program
    .name('register')
    .description('Registers a server to the registry contract')
    .argument('<contractAddress>', 'address of the registry contract')
    .argument('<registryKeyFile>', 'registry secret key file')
    .argument('<entryDetailsFile>', 'path to a JSON file with the registry entry details')
    .option('--private-state-id <id>', 'private state ID (defaults to a random value)')
    .parse();

  const networkId = requireNetworkId();

  const [contractAddress, registryKeyFile, entryDetailsFile] = program.args;
  const opts = program.opts<{ privateStateId?: string }>();
  const privateStateId = opts.privateStateId ?? crypto.randomBytes(32).toString('hex');

  const secretKey = new Uint8Array(Buffer.from(fs.readFileSync(registryKeyFile, 'utf-8').trim(), 'hex'));

  const raw = JSON.parse(fs.readFileSync(entryDetailsFile, 'utf-8'));

  const ipStr: string = typeof raw.ip === 'string' ? raw.ip : raw.ip.address;
  const entry: RegistryEntry = {
    ip: ipStr.includes(':') ? { kind: 'ipv6', address: ipStr } : { kind: 'ipv4', address: ipStr },
    port: raw.port,
    validTo: timestampToDate(raw.validTo),
  };

  return withAppContext(networkId, (ctx) =>
    register(ctx, secretKey, {
      contractAddress,
      privateStateId,
      entry,
    })
  );
}

runCli(main);
