import * as fs from 'fs';
import { generateMnemonic, wordlist } from '@blaze-cardano/core';
import { Provider } from '@blaze-cardano/sdk';
import { mnemonicToSeedFile } from './common';

export interface GenerateWalletArgs {
  seedFile: string;
  mnemonicFile: string;
}

export interface GenerateWalletResult {
  seedFile: string;
  mnemonicFile: string;
  address: string;
}

export async function generateWallet(provider: Provider, args: GenerateWalletArgs): Promise<GenerateWalletResult> {
  const mnemonic = generateMnemonic(wordlist);
  const address = await mnemonicToSeedFile(provider, mnemonic, args.seedFile);

  fs.writeFileSync(args.mnemonicFile, mnemonic);

  return {
    seedFile: args.seedFile,
    mnemonicFile: args.mnemonicFile,
    address,
  };
}
