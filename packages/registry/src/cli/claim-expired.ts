import { TxResult } from '@sundaeswap/capacity-exchange-core';
import { requireEnvVar, resolveEnv, runCli, withAppContextFromEnv } from '@sundaeswap/capacity-exchange-nodejs';
import { program } from 'commander';
import { claimExpired } from '../circuits/claim-expired.js';
import { parseRegistryKeyHex } from '../types.js';
import { resolveRegistryAddress } from '../defaultAddresses.js';

function main(): Promise<TxResult> {
  program
    .name('claim-expired')
    .description('Claims the collateral from an expired registry entry')
    .argument('[contractAddress]', 'address of the registry contract (defaults to well-known address for network)')
    .argument('<registryKey>', 'hex-encoded 32-byte registry key of the expired entry')
    .argument('<recipientAddress>', 'the address that will receive the collateral refund')
    .parse();

  const networkId = requireEnvVar(resolveEnv(), 'NETWORK_ID');

  const [contractAddressArg, registryKeyHex, recipientAddress] = program.args;
  const contractAddress = resolveRegistryAddress(networkId, contractAddressArg);

  const registryKey = parseRegistryKeyHex(registryKeyHex);

  return withAppContextFromEnv(networkId, (ctx) =>
    claimExpired(ctx, {
      contractAddress,
      registryKey,
      recipientAddress,
    })
  );
}

runCli(main);
