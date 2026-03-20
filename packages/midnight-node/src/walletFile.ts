import * as fs from 'fs';
import * as path from 'path';
import { parseMnemonic, parseSeedHex } from '@capacity-exchange/midnight-core';

function mnemonicFilename(network: string): string {
  return `wallet-mnemonic.${network.toLowerCase()}.txt`;
}

function seedFilename(network: string): string {
  return `wallet-seed.${network.toLowerCase()}.hex`;
}

/**
 * Walks up the directory tree from `startDir` looking for a file with `filename`.
 * Returns the absolute path to the file, or null if not found.
 */
function findFileWalkUp(filename: string, startDir: string): string | null {
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

/**
 * Walks up the directory tree from `startDir` looking for `wallet-mnemonic.{network}.txt`.
 * Returns the absolute path to the file, or throws if not found.
 */
export function findWalletMnemonicFile(network: string, startDir: string = process.cwd()): string {
  const filename = mnemonicFilename(network);
  const found = findFileWalkUp(filename, startDir);
  if (found) {
    return found;
  }
  throw new Error(
    `Wallet mnemonic file not found: ${filename}. ` +
      `Create it at the project root: echo 'your mnemonic' > ${filename}`
  );
}

/**
 * Finds and reads a wallet seed or mnemonic file for the given network,
 * walking up the directory tree from `startDir`.
 * Looks for `wallet-seed.{network}.hex` first, then `wallet-mnemonic.{network}.txt`.
 * Returns the parsed seed as a Uint8Array.
 */
export function loadWalletSeedFromFile(network: string, startDir: string = process.cwd()): Uint8Array {
  const seedFile = findFileWalkUp(seedFilename(network), startDir);
  if (seedFile) {
    const seedHex = fs.readFileSync(seedFile, 'utf-8').trim();
    return parseSeedHex(seedHex);
  }

  const mnemonicFile = findFileWalkUp(mnemonicFilename(network), startDir);
  if (mnemonicFile) {
    const mnemonic = fs.readFileSync(mnemonicFile, 'utf-8').trim();
    return parseMnemonic(mnemonic);
  }

  throw new Error(
    `Wallet file not found for network '${network}'. ` +
      `Create wallet-seed.${network}.hex or wallet-mnemonic.${network}.txt at the project root.`
  );
}
