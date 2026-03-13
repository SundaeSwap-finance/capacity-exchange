import * as fs from 'fs';
import * as path from 'path';
import { parseMnemonic } from '@capacity-exchange/midnight-core';

function mnemonicFilename(network: string): string {
  return `wallet-mnemonic.${network.toLowerCase()}.txt`;
}

/**
 * Walks up the directory tree from `startDir` looking for `wallet-mnemonic.{network}.txt`.
 * Returns the absolute path to the file, or throws if not found.
 */
export function findWalletMnemonicFile(network: string, startDir: string = process.cwd()): string {
  const filename = mnemonicFilename(network);
  let dir = path.resolve(startDir);

  while (true) {
    const candidate = path.join(dir, filename);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(
        `Wallet mnemonic file not found: ${filename}. ` +
          `Create it at the project root: echo 'your mnemonic' > ${filename}`
      );
    }
    dir = parent;
  }
}

/**
 * Finds and reads a wallet mnemonic file for the given network,
 * walking up the directory tree from `startDir`.
 * Returns the parsed seed as a Uint8Array.
 */
export function loadWalletSeedFromFile(network: string, startDir: string = process.cwd()): Uint8Array {
  const filePath = findWalletMnemonicFile(network, startDir);
  const mnemonic = fs.readFileSync(filePath, 'utf-8').trim();
  return parseMnemonic(mnemonic);
}
