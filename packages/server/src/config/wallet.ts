import {
  parseSeedHex,
  parseMnemonic,
  uint8ArrayToHex,
} from '@capacity-exchange/midnight-core';
import { loadWalletSeedFromFile } from '@capacity-exchange/midnight-node';
import type { AppEnv } from './env.js';
import { readFileOrError } from './files.js';

interface Logger {
  info(msg: string): void;
}

/** Resolve the wallet seed hex from env config (mnemonic file, seed file, or walk-up). */
export async function loadWalletSeed(env: AppEnv, log: Logger): Promise<string> {
  if (env.WALLET_SEED_FILE && env.WALLET_MNEMONIC_FILE) {
    throw new Error("Can't specify both WALLET_SEED_FILE and WALLET_MNEMONIC_FILE");
  }
  if (env.WALLET_MNEMONIC_FILE) {
    log.info(`Loading wallet from mnemonic file: ${env.WALLET_MNEMONIC_FILE}`);
    const mnemonic = await readFileOrError(env.WALLET_MNEMONIC_FILE, 'Failed to read wallet mnemonic from');
    return uint8ArrayToHex(parseMnemonic(mnemonic));
  }
  if (env.WALLET_SEED_FILE) {
    log.info(`Loading wallet from seed file: ${env.WALLET_SEED_FILE}`);
    const seedStr = await readFileOrError(env.WALLET_SEED_FILE, 'Failed to read wallet seed from');
    parseSeedHex(seedStr);
    return seedStr.trim();
  }
  if (env.MIDNIGHT_NETWORK.toLowerCase() === 'mainnet') {
    throw new Error('WALLET_MNEMONIC_FILE or WALLET_SEED_FILE is required on mainnet');
  }
  log.info(`Loading wallet via wallet-mnemonic.${env.MIDNIGHT_NETWORK}.txt (walk-up)`);
  return uint8ArrayToHex(loadWalletSeedFromFile(env.MIDNIGHT_NETWORK));
}
