import { TxResult } from '@sundaeswap/capacity-exchange-core';
import { requireNetworkId, runCli, withAppContext } from '@capacity-exchange/midnight-node';
import { program } from 'commander';
import { deregister } from '../circuits/deregister.js';
import { readSecretKeyFile } from '../types.js';

function main(): Promise<TxResult> {
  program
    .name('deregister')
    .description('Deregisters a server from the registry contract')
    .argument('<contractAddress>', 'address of the registry contract')
    .argument('<secretKeyFile>', 'registry secret key file')
    .argument('<recipientAddress>', 'the address that will receive the collateral refund')
    .parse();

  const networkId = requireNetworkId();

  const [contractAddress, secretKeyFile, recipientAddress] = program.args;

  const secretKey = readSecretKeyFile(secretKeyFile);

  return withAppContext(networkId, (ctx) =>
    deregister(ctx, {
      contractAddress,
      secretKey,
      recipientAddress,
    })
  );
}

runCli(main);
