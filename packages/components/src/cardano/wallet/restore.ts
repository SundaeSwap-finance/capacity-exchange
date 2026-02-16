import * as fs from 'fs';
import { Provider } from '@blaze-cardano/sdk';
import { mnemonicToSeedFile } from './common';

export interface RestoreWalletArgs {
  seedFile: string;
  mnemonicIn: string;
}

export interface RestoreWalletResult {
  seedFile: string;
  address: string;
}

export async function restoreWallet(
  provider: Provider,
  args: RestoreWalletArgs
): Promise<RestoreWalletResult> {
  const mnemonic = fs.readFileSync(args.mnemonicIn, 'utf-8').trim();
  const address = await mnemonicToSeedFile(provider, mnemonic, args.seedFile);

  return {
    seedFile: args.seedFile,
    address,
  };
}
