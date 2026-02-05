import * as fs from 'fs';
import { Bip32PrivateKey, generateMnemonic, mnemonicToEntropy, wordlist } from '@blaze-cardano/core';
import { Blaze, HotWallet, Provider, Wallet } from '@blaze-cardano/sdk';
import { BIP39_PASSPHRASE } from './constants';

export interface GenerateWalletArgs {
  outputFile: string;
  mnemonic?: string;
}

export interface GenerateWalletResult {
  mnemonic: string;
  seedFile: string;
  address: string;
}

export async function generateWallet(
  blaze: Blaze<Provider, Wallet>,
  args: GenerateWalletArgs,
): Promise<GenerateWalletResult> {
  const mnemonic = args.mnemonic || generateMnemonic(wordlist);
  const entropy = mnemonicToEntropy(mnemonic, wordlist);
  const masterKey = Bip32PrivateKey.fromBip39Entropy(Buffer.from(entropy), BIP39_PASSPHRASE);

  fs.writeFileSync(args.outputFile, masterKey.hex());

  const wallet = await HotWallet.fromMasterkey(masterKey.hex(), blaze.provider);
  const address = await wallet.getChangeAddress();

  return {
    mnemonic,
    seedFile: args.outputFile,
    address: address.toBech32(),
  };
}
