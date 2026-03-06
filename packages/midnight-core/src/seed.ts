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

/**
 * Resolves a wallet seed from an env record by looking for `{prefix}_SEED`
 * or `{prefix}_MNEMONIC`. Exactly one must be set.
 */
export function resolveWalletSeed(env: Record<string, string | undefined>, prefix: string): Uint8Array {
  const seed = env[`${prefix}_SEED`];
  const mnemonic = env[`${prefix}_MNEMONIC`];

  if (seed && mnemonic) {
    throw new Error(`Set exactly one of ${prefix}_SEED or ${prefix}_MNEMONIC, not both`);
  }
  if (mnemonic) {
    return parseMnemonic(mnemonic);
  }
  if (seed) {
    return parseSeedHex(seed);
  }
  throw new Error(`Missing ${prefix}_SEED or ${prefix}_MNEMONIC`);
}
