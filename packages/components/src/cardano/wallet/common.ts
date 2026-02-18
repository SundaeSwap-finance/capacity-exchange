import * as fs from 'fs';
import { Bip32PrivateKey, mnemonicToEntropy, wordlist } from '@blaze-cardano/core';
import { HotWallet, Provider } from '@blaze-cardano/sdk';
const BIP39_PASSPHRASE = '';

export async function mnemonicToSeedFile(provider: Provider, mnemonic: string, seedFile: string): Promise<string> {
  const entropy = mnemonicToEntropy(mnemonic, wordlist);
  const masterKey = Bip32PrivateKey.fromBip39Entropy(Buffer.from(entropy), BIP39_PASSPHRASE);

  fs.writeFileSync(seedFile, masterKey.hex());

  const wallet = await HotWallet.fromMasterkey(masterKey.hex(), provider);
  const address = await wallet.getChangeAddress();

  return address.toBech32();
}
