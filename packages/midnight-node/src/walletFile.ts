import * as fs from 'fs';
import * as path from 'path';
import { parseMnemonic, parseSeedHex } from '@sundaeswap/capacity-exchange-core';

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

/**
 * Loads a wallet seed for the given network. Checks WALLET_SEED_FILE,
 * WALLET_MNEMONIC_FILE, then walks up from `startDir` for seed/mnemonic files.
 */
// TODO: unify with server wallet loading (apps/server/src/config/wallet.ts resolveWalletSeedHex)
export function loadWalletSeed(network: string, startDir: string = process.cwd()): Uint8Array {
  if (process.env.WALLET_SEED_FILE) {
    const hex = fs.readFileSync(process.env.WALLET_SEED_FILE, 'utf-8').trim();
    return parseSeedHex(hex);
  }
  if (process.env.WALLET_MNEMONIC_FILE) {
    const mnemonic = fs.readFileSync(process.env.WALLET_MNEMONIC_FILE, 'utf-8').trim();
    return parseMnemonic(mnemonic);
  }
  const seedFile = findFileUp(seedFilename(network), startDir);
  if (seedFile) {
    const hex = fs.readFileSync(seedFile, 'utf-8').trim();
    return parseSeedHex(hex);
  }
  const mnemonicFile = findFileUp(mnemonicFilename(network), startDir);
  if (mnemonicFile) {
    const mnemonic = fs.readFileSync(mnemonicFile, 'utf-8').trim();
    return parseMnemonic(mnemonic);
  }
  throw new Error(
    `No wallet file found for network '${network}'. ` +
      `Set WALLET_SEED_FILE or WALLET_MNEMONIC_FILE, or create ` +
      `${seedFilename(network)} or ${mnemonicFilename(network)} in the project tree.`
  );
}
