import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

export function parseSeedHex(hex: string): Uint8Array {
  const cleaned = hex.trim().replace(/^0x/, '');
  if (cleaned.length === 0 || cleaned.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(cleaned)) {
    throw new Error('Invalid hex string');
  }
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

/** Generate a new BIP-39 mnemonic (24 words / 256 bits of entropy). */
export function generateMnemonic(): string {
  return bip39.generateMnemonic(wordlist, 256);
}

/** Convert a mnemonic to a hex-encoded seed suitable for HDWallet.fromSeed. */
export function mnemonicToSeedHex(mnemonic: string): string {
  const seed = parseMnemonic(mnemonic);
  return Array.from(seed)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
