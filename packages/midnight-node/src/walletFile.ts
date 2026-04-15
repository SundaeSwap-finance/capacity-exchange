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
 * Finds and reads a wallet seed or mnemonic file for the given network.
 *
 * Resolution order:
 *   1. WALLET_SEED_FILE env var (explicit hex seed file path)
 *   2. WALLET_MNEMONIC_FILE env var (explicit mnemonic file path)
 *   3. Walk up from `startDir` looking for `wallet-seed.{network}.hex`
 *   4. Walk up from `startDir` looking for `wallet-mnemonic.{network}.txt`
 *
 * Returns the parsed seed as a Uint8Array.
 *
 * TODO: The server (apps/server/src/config/wallet.ts) has its own resolution
 * logic that duplicates steps 1-4 plus AWS Secrets Manager support. Unify
 * the file-based resolution into this function so the server only needs
 * its own code for the AWS secrets path.
 */
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
