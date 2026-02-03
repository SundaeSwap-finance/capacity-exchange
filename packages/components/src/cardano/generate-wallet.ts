import * as fs from 'fs';
import { Bip32PrivateKey, generateMnemonic, mnemonicToEntropy, wordlist } from '@blaze-cardano/core';
import { HotWallet } from '@blaze-cardano/sdk';
import { CardanoConfig } from './config';
import { BIP39_PASSPHRASE } from './constants';
import { createProvider } from './wallet';

export interface GenerateWalletArgs {
  outputFile: string;
  mnemonic?: string;
}

export interface GenerateWalletResult {
  mnemonic: string;
  seedFile: string;
  address: string;
  network: string;
}

export async function generateWallet(config: CardanoConfig, args: GenerateWalletArgs): Promise<GenerateWalletResult> {
  const mnemonic = args.mnemonic || generateMnemonic(wordlist);
  const entropy = mnemonicToEntropy(mnemonic, wordlist);
  const masterKey = Bip32PrivateKey.fromBip39Entropy(Buffer.from(entropy), BIP39_PASSPHRASE);

  fs.writeFileSync(args.outputFile, masterKey.hex());

  const provider = createProvider(config);
  const wallet = await HotWallet.fromMasterkey(masterKey.hex(), provider);
  const address = await wallet.getChangeAddress();

  return {
    mnemonic,
    seedFile: args.outputFile,
    address: address.toBech32(),
    network: config.network,
  };
}
