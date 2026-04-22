import * as fs from 'fs';
import * as path from 'path';
import { parseMnemonic, parseSeedHex } from '@sundaeswap/capacity-exchange-core';
import type { Env } from './env.js';

function seedFilename(network: string): string {
  return `wallet-seed.${network.toLowerCase()}.hex`;
}

function mnemonicFilename(network: string): string {
  return `wallet-mnemonic.${network.toLowerCase()}.txt`;
}

/**
 * Walks up the directory tree from `startDir` looking for a file with the given name.
 * Returns the absolute path if found, or null.
 */
function findFileUp(filename: string, startDir: string): string | null {
  let dir = path.resolve(startDir);
  while (true) {
    const candidate = path.join(dir, filename);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return null;
    }
    dir = parent;
  }
}

export function findWalletSeedFile(network: string, startDir: string = process.cwd()): string {
  const filename = seedFilename(network);
  const found = findFileUp(filename, startDir);
  if (!found) {
    throw new Error(
      `Wallet seed file not found: ${filename}. ` + `Create it at the project root with a hex-encoded seed.`
    );
  }
  return found;
}

export function findWalletMnemonicFile(network: string, startDir: string = process.cwd()): string {
  const filename = mnemonicFilename(network);
  const found = findFileUp(filename, startDir);
  if (!found) {
    throw new Error(
      `Wallet mnemonic file not found: ${filename}. ` +
        `Create it at the project root: echo 'your mnemonic' > ${filename}`
    );
  }
  return found;
}

/** Loads a wallet seed from a hex-encoded seed file. */
export function loadSeedFromFile(filePath: string): Uint8Array {
  return parseSeedHex(fs.readFileSync(filePath, 'utf-8').trim());
}

/** Loads a wallet seed derived from a mnemonic file. */
export function loadMnemonicFromFile(filePath: string): Uint8Array {
  return parseMnemonic(fs.readFileSync(filePath, 'utf-8').trim());
}

/** Loads a wallet seed from env. Requires exactly one of WALLET_SEED_FILE or
 *  WALLET_MNEMONIC_FILE. No directory walk-up. */
export function loadWalletSeedFromEnv(env: Env): Uint8Array {
  const hasSeed = !!env.WALLET_SEED_FILE;
  const hasMnemonic = !!env.WALLET_MNEMONIC_FILE;
  if (hasSeed === hasMnemonic) {
    throw new Error('Set exactly one of WALLET_SEED_FILE or WALLET_MNEMONIC_FILE');
  }
  return hasSeed ? loadSeedFromFile(env.WALLET_SEED_FILE!) : loadMnemonicFromFile(env.WALLET_MNEMONIC_FILE!);
}

/** Loads a seed from env vars; falls back to walking up from `startDir`. */
// TODO: remove walk-up once `apps/demo` and `apps/server` set env explicitly.
// TODO: unify with `apps/server/src/config/wallet.ts` resolveWalletSeedHex.
export function loadWalletSeed(network: string, env: Env = process.env, startDir: string = process.cwd()): Uint8Array {
  if (env.WALLET_SEED_FILE) {
    return loadSeedFromFile(env.WALLET_SEED_FILE);
  }
  if (env.WALLET_MNEMONIC_FILE) {
    return loadMnemonicFromFile(env.WALLET_MNEMONIC_FILE);
  }
  const seedFile = findFileUp(seedFilename(network), startDir);
  if (seedFile) {
    return loadSeedFromFile(seedFile);
  }
  const mnemonicFile = findFileUp(mnemonicFilename(network), startDir);
  if (mnemonicFile) {
    return loadMnemonicFromFile(mnemonicFile);
  }
  throw new Error(
    `No wallet file found for network '${network}'. ` +
      `Set WALLET_SEED_FILE or WALLET_MNEMONIC_FILE, or create ` +
      `${seedFilename(network)} or ${mnemonicFilename(network)} in the project tree.`
  );
}
