// Builds an unsigned CNIGHT → Dust registration transaction on Cardano.
//
// Usage:
//   BLOCKFROST_PROJECT_ID=... CARDANO_NETWORK=mainnet \
//     bun run scripts/dust-registration/register.ts \
//       --address addr1q8stdr3z... \
//       --dust-address mn_dust1w00t93...
//
// Outputs the unsigned transaction CBOR to stdout for external signing and submission.

import { program } from 'commander';
import { TxBuilder, Blockfrost } from '@blaze-cardano/sdk';
import {
  Address,
  AssetId,
  Datum,
  Hash28ByteBase16,
  TransactionOutput,
  Value,
} from '@blaze-cardano/core';
import { toBlockfrostNetworkName, type CardanoNetwork } from '@capacity-exchange/midnight-core';
import {
  requireEnv,
  getNetworkId,
  getScriptAddress,
  registrationScript,
  registrationPolicyId,
  beaconAssetName,
  buildRegistrationDatum,
  buildMintRedeemer,
} from './contract.js';

// Convert between bit groups (BIP173 convertbits)
function convertBits(data: number[], fromBits: number, toBits: number, pad: boolean): number[] {
  let acc = 0;
  let bits = 0;
  const result: number[] = [];
  const maxv = (1 << toBits) - 1;
  for (const value of data) {
    acc = (acc << fromBits) | value;
    bits += fromBits;
    while (bits >= toBits) {
      bits -= toBits;
      result.push((acc >> bits) & maxv);
    }
  }
  if (pad) {
    if (bits > 0) {
      result.push((acc << (toBits - bits)) & maxv);
    }
  }
  return result;
}

// Decode a bech32 Midnight dust address to raw hex bytes.
function decodeDustAddress(bech32Addr: string): string {
  const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  const sepIdx = bech32Addr.lastIndexOf('1');
  const dataPart = bech32Addr.slice(sepIdx + 1);

  // Strip the 6-char checksum
  const encoded = dataPart.slice(0, -6);

  // Decode to 5-bit values
  const bits5: number[] = [];
  for (const c of encoded) {
    const val = CHARSET.indexOf(c);
    if (val === -1) throw new Error(`Invalid bech32 character: ${c}`);
    bits5.push(val);
  }

  // Convert from 5-bit groups to 8-bit bytes (no witness version for mn_dust)
  const bytes = convertBits(bits5, 5, 8, false);
  const hex = Buffer.from(bytes).toString('hex');

  if (bytes.length === 32) {
    return '73' + hex;
  }
  return hex;
}

async function main() {
  program
    .name('register-dust')
    .description('Build an unsigned dust registration transaction on Cardano')
    .requiredOption('--address <addr>', 'Cardano base address (source of funds, must have staking component)')
    .requiredOption('--dust-address <addr>', 'Midnight dust address (mn_dust1...)')
    .option('--lock-utxo <ref...>', 'UTxO reference(s) to exclude from coin selection, format: <txHash>#<index>')
    .parse();

  const opts = program.opts<{ address: string; dustAddress: string; lockUtxo?: string[] }>();
  const lockedRefs = new Set(opts.lockUtxo ?? []);

  const network = requireEnv('CARDANO_NETWORK') as CardanoNetwork;
  const blockfrostProjectId = requireEnv('BLOCKFROST_PROJECT_ID');
  const networkId = getNetworkId(network);

  const walletAddress = Address.fromBech32(opts.address);
  const addrBytes = walletAddress.toBytes();

  // A base address has: 1 byte header + 28 bytes payment key hash + 28 bytes stake key hash
  const headerByte = parseInt(addrBytes.slice(0, 2), 16);
  const addrType = (headerByte >> 4) & 0x0f;
  if (addrType !== 0x00 && addrType !== 0x01) {
    throw new Error('Address must be a base address (with staking component)');
  }

  const paymentKeyHash = addrBytes.slice(2, 58);
  const stakeKeyHash = addrBytes.slice(58, 114);

  console.error(`Payment key hash: ${paymentKeyHash}`);
  console.error(`Stake key hash:   ${stakeKeyHash}`);

  const dustAddressHex = decodeDustAddress(opts.dustAddress);
  console.error(`Dust address (hex): ${dustAddressHex}`);

  if (dustAddressHex.length / 2 > 33) {
    throw new Error(`Dust address too long: ${dustAddressHex.length / 2} bytes (max 33)`);
  }

  console.error(`Registration policy ID: ${registrationPolicyId}`);

  const scriptAddress = getScriptAddress(networkId);
  console.error(`Script address: ${scriptAddress.toBech32()}`);

  const provider = new Blockfrost({
    network: toBlockfrostNetworkName(network),
    projectId: blockfrostProjectId,
  });

  const allUtxos = await provider.getUnspentOutputs(walletAddress);
  const utxos = allUtxos.filter((u) => {
    const ref = `${u.input().transactionId()}#${u.input().index()}`;
    return !lockedRefs.has(ref);
  });
  if (lockedRefs.size > 0) {
    console.error(`Excluded ${allUtxos.length - utxos.length} locked UTxO(s) from coin selection`);
  }
  if (utxos.length === 0) {
    throw new Error('No UTxOs found at the provided address (after excluding locked UTxOs)');
  }

  const params = await provider.getParameters();
  const datum = buildRegistrationDatum(stakeKeyHash, dustAddressHex);
  const redeemer = buildMintRedeemer();

  const txBuilder = new TxBuilder(params);

  const assetId = AssetId.fromParts(registrationPolicyId, beaconAssetName);
  const outputValue = new Value(0n, new Map([[assetId, 1n]]));
  const txOutput = new TransactionOutput(scriptAddress, outputValue);
  txOutput.setDatum(Datum.newInlineData(datum));

  txBuilder
    .setNetworkId(networkId)
    .useEvaluator((tx, utxoSet) => provider.evaluateTransaction(tx, utxoSet))
    .addUnspentOutputs(utxos)
    .addMint(registrationPolicyId, new Map([[beaconAssetName, 1n]]), redeemer)
    .provideScript(registrationScript)
    .addOutput(txOutput)
    .addRequiredSigner(Hash28ByteBase16(paymentKeyHash))
    .addRequiredSigner(Hash28ByteBase16(stakeKeyHash))
    .setChangeAddress(walletAddress);

  const tx = await txBuilder.complete();

  console.error(`\nTransaction built successfully`);
  console.error(`Transaction ID: ${tx.getId()}`);
  console.error(`Transaction size: ${tx.toCbor().length / 2} bytes`);

  console.log(tx.toCbor());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
