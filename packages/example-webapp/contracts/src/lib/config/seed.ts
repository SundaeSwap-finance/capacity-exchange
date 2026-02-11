import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

export function parseSeedHex(hex: string): Buffer {
  return Buffer.from(hex.trim(), 'hex');
}

export function parseMnemonic(mnemonic: string): Buffer {
  const words = mnemonic.trim().split(/\s+/).join(' ');
  if (!bip39.validateMnemonic(words, wordlist)) {
    throw new Error('Invalid mnemonic phrase');
  }
  const seed = bip39.mnemonicToSeedSync(words);
  return Buffer.from(seed);
}
