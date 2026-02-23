import { Bip32PrivateKey, mnemonicToEntropy, wordlist } from '@blaze-cardano/core';
import { HotWallet, Blaze, Provider, Wallet } from '@blaze-cardano/sdk';
import * as fs from 'fs';
const BIP39_PASSPHRASE = '';

export async function createBlazeFromMnemonicFile(
  provider: Provider,
  mnemonicFile: string
): Promise<Blaze<Provider, Wallet>> {
  const mnemonic = fs.readFileSync(mnemonicFile, 'utf-8').trim();
  const entropy = mnemonicToEntropy(mnemonic, wordlist);
  const masterKey = Bip32PrivateKey.fromBip39Entropy(Buffer.from(entropy), BIP39_PASSPHRASE);
  const wallet = await HotWallet.fromMasterkey(masterKey.hex(), provider);

  return Blaze.from(provider, wallet);
}
