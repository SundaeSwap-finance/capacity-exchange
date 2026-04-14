import * as fs from 'fs';
import * as crypto from 'crypto';

import { TxResult } from '@capacity-exchange/midnight-core';
import { requireNetworkId, runCli, withAppContext } from '@capacity-exchange/midnight-node';
import { program } from 'commander';
import { deregister } from '../circuits/deregister.js';

function main(): Promise<TxResult> {
  program
    .name('deregister')
    .description('Deregisters a server from the registry contract')
    .argument('<contractAddress>', 'address of the registry contract')
    .argument('<secretKeyFile>', 'registry secret key file')
    .argument('<recipientAddress>', 'the address that will receive the collateral refund')
    .option('--private-state-id <id>', 'private state ID (defaults to a random value)')
    .parse();

  const networkId = requireNetworkId();

  const [contractAddress, secretKeyFile, recipientAddress] = program.args;
  const opts = program.opts<{ privateStateId?: string }>();
  const privateStateId = opts.privateStateId ?? crypto.randomBytes(32).toString('hex');

  const secretKey = new Uint8Array(Buffer.from(fs.readFileSync(secretKeyFile, 'utf-8').trim(), 'hex'));

  return withAppContext(networkId, (ctx) =>
    deregister(ctx, {
      contractAddress,
      privateStateId,
      secretKey,
      recipientAddress,
    })
  );
}

runCli(main);
