import * as fs from 'fs';
import * as crypto from 'crypto';

import { TxResult } from '@capacity-exchange/midnight-core';
import { requireNetworkId, runCli, withAppContext } from '@capacity-exchange/midnight-node';
import { program } from 'commander';
import { refreshValidity } from '../circuits/refreshValidity.js';
import { timestampToDate } from '../types.js';

function main(): Promise<TxResult> {
  program
    .name('refresh-validity')
    .description('Updates the validity of the entry in the registry')
    .argument('<contractAddress>', 'address of the registry contract')
    .argument('<secretKeyFile>', 'registry secret key file')
    .argument('<validTo>', 'new validTo as a Unix timestamp in seconds (e.g. 1776297600)')
    .option('--private-state-id <id>', 'private state ID (defaults to a random value)')
    .parse();

  const networkId = requireNetworkId();

  const [contractAddress, secretKeyFile, validToArg] = program.args;
  const opts = program.opts<{ privateStateId?: string }>();
  const privateStateId = opts.privateStateId ?? crypto.randomBytes(32).toString('hex');

  const secretKey = new Uint8Array(Buffer.from(fs.readFileSync(secretKeyFile, 'utf-8').trim(), 'hex'));

  const validTo = timestampToDate(validToArg);

  return withAppContext(networkId, (ctx) =>
    refreshValidity(ctx, secretKey, {
      contractAddress,
      privateStateId,
      validTo,
      validToInt: BigInt(validToArg),
    })
  );
}

runCli(main);
