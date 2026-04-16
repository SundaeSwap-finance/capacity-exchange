import { TxResult } from '@capacity-exchange/midnight-core';
import { requireNetworkId, runCli, withAppContext } from '@capacity-exchange/midnight-node';
import { program } from 'commander';
import { claimExpired } from '../circuits/claim-expired.js';

function main(): Promise<TxResult> {
  program
    .name('claim-expired')
    .description('Claims the collateral from an expired registry entry')
    .argument('<contractAddress>', 'address of the registry contract')
    .argument('<registryKey>', 'hex-encoded 32-byte registry key of the expired entry')
    .argument('<recipientAddress>', 'the address that will receive the collateral refund')
    .parse();

  const networkId = requireNetworkId();

  const [contractAddress, registryKeyHex, recipientAddress] = program.args;

  const registryKey = new Uint8Array(Buffer.from(registryKeyHex, 'hex'));

  return withAppContext(networkId, (ctx) =>
    claimExpired(ctx, {
      contractAddress,
      registryKey,
      recipientAddress,
    })
  );
}

runCli(main);
