// Builds an unsigned transaction to deregister (clean up) CNIGHT → Dust registrations on Cardano.
//
// Usage:
//   BLOCKFROST_PROJECT_ID=... CARDANO_NETWORK=mainnet \
//     bun run scripts/dust-registration/deregister.ts \
//       --address addr1q8stdr3z... \
//       --utxo <txHash>#<index> [--utxo <txHash>#<index> ...]
//
// Supports multiple --utxo flags to deregister several registrations in one transaction.
// Outputs the unsigned transaction CBOR to stdout for external signing and submission.

import { program } from 'commander';
import { TxBuilder, Blockfrost } from '@blaze-cardano/sdk';
import {
  Address,
  Hash28ByteBase16,
  TransactionId,
  TransactionInput,
} from '@blaze-cardano/core';
import { toBlockfrostNetworkName, type CardanoNetwork } from '@capacity-exchange/midnight-core';
import {
  requireEnv,
  getNetworkId,
  registrationScript,
  registrationPolicyId,
  beaconAssetName,
  buildSpendRedeemer,
  buildBurnRedeemer,
  extractStakeKeyFromDatum,
} from './contract.js';

function parseUtxoRef(ref: string): { txHash: string; index: number } {
  const [txHash, indexStr] = ref.split('#');
  if (!txHash || indexStr === undefined) {
    throw new Error(`Invalid UTxO reference: ${ref}. Expected format: <txHash>#<index>`);
  }
  return { txHash, index: parseInt(indexStr, 10) };
}

async function main() {
  program
    .name('deregister-dust')
    .description('Build an unsigned transaction to deregister (clean up) dust registrations on Cardano')
    .requiredOption('--address <addr>', 'Cardano base address (receives reclaimed ADA, provides collateral)')
    .requiredOption('--utxo <ref...>', 'UTxO reference(s) to deregister, format: <txHash>#<index>')
    .parse();

  const opts = program.opts<{ address: string; utxo: string[] }>();

  const network = requireEnv('CARDANO_NETWORK') as CardanoNetwork;
  const blockfrostProjectId = requireEnv('BLOCKFROST_PROJECT_ID');
  const networkId = getNetworkId(network);

  const walletAddress = Address.fromBech32(opts.address);
  console.error(`Registration policy ID: ${registrationPolicyId}`);

  const provider = new Blockfrost({
    network: toBlockfrostNetworkName(network),
    projectId: blockfrostProjectId,
  });

  const params = await provider.getParameters();
  const walletUtxos = await provider.getUnspentOutputs(walletAddress);
  if (walletUtxos.length === 0) {
    throw new Error('No UTxOs found at the provided address');
  }

  const txBuilder = new TxBuilder(params);
  txBuilder
    .setNetworkId(networkId)
    .useEvaluator((tx, utxoSet) => provider.evaluateTransaction(tx, utxoSet))
    .addUnspentOutputs(walletUtxos)
    .provideScript(registrationScript)
    .setChangeAddress(walletAddress);

  const requiredSigners = new Set<string>();

  // Payment key hash from wallet address
  const addrBytes = walletAddress.toBytes();
  const paymentKeyHash = addrBytes.slice(2, 58);
  requiredSigners.add(paymentKeyHash);

  let totalBurn = 0n;

  for (const ref of opts.utxo) {
    const { txHash, index } = parseUtxoRef(ref);
    console.error(`\nProcessing UTxO: ${txHash}#${index}`);

    const txInput = new TransactionInput(TransactionId(txHash), BigInt(index));
    const resolved = await provider.resolveUnspentOutputs([txInput]);
    if (resolved.length === 0) {
      throw new Error(`UTxO not found: ${txHash}#${index}`);
    }

    const utxo = resolved[0];
    const datum = utxo.output().datum()?.asInlineData();
    if (!datum) {
      throw new Error(`UTxO ${txHash}#${index} has no inline datum`);
    }

    const stakeKeyHash = extractStakeKeyFromDatum(datum);
    console.error(`  Stake key hash: ${stakeKeyHash}`);
    requiredSigners.add(stakeKeyHash);

    txBuilder.addInput(utxo, buildSpendRedeemer());
    totalBurn -= 1n;
  }

  console.error(`\nBurning ${-totalBurn} beacon token(s)`);
  txBuilder.addMint(registrationPolicyId, new Map([[beaconAssetName, totalBurn]]), buildBurnRedeemer());

  for (const signer of requiredSigners) {
    txBuilder.addRequiredSigner(Hash28ByteBase16(signer));
  }

  const tx = await txBuilder.complete();

  console.error(`\nTransaction built successfully`);
  console.error(`Transaction ID: ${tx.getId()}`);
  console.error(`Transaction size: ${tx.toCbor().length / 2} bytes`);
  console.error(`Required signers: ${[...requiredSigners].join(', ')}`);

  console.log(tx.toCbor());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
