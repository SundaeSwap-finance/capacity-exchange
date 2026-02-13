import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

export function parseSeedHex(hex: string): Uint8Array {
  const cleaned = hex.trim().replace(/^0x/, '');
  const bytes = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleaned.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function parseMnemonic(mnemonic: string): Uint8Array {
  const words = mnemonic.trim().split(/\s+/).join(' ');
  if (!bip39.validateMnemonic(words, wordlist)) {
    throw new Error('Invalid mnemonic phrase');
  }
  return bip39.mnemonicToSeedSync(words);
}
