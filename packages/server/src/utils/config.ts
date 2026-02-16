import { FastifyBaseLogger } from 'fastify';
import fs from 'node:fs/promises';
import path from 'node:path';
import * as bip39 from '@scure/bip39';
import { wordlist as english } from '@scure/bip39/wordlists/english.js';
import { BaseConfig } from '../models/config.js';
import { PriceFormula } from '../services/price.js';

export const getWalletSeed = async (
  baseConfig: BaseConfig,
  log: FastifyBaseLogger,
): Promise<string> => {
  validateWalletConfig(baseConfig);
  return loadWalletSeed(baseConfig, log);
};

const validateWalletConfig = (config: BaseConfig) => {
  if (config.WALLET_SEED_FILE && config.WALLET_MNEMONIC_FILE) {
    throw new Error("Can't specify both WALLET_SEED_FILE and WALLET_MNEMONIC_FILE");
  }
};

const loadWalletSeed = async (config: BaseConfig, log: FastifyBaseLogger): Promise<string> => {
  if (config.WALLET_MNEMONIC_FILE) {
    log.info(`Loading wallet from mnemonic: ${config.WALLET_MNEMONIC_FILE}`);
    return loadSeedFromMnemonic(config, log);
  } else if (config.WALLET_SEED_FILE) {
    log.info(`Loading wallet from seed: ${config.WALLET_SEED_FILE}`);
    return loadSeedFromFile(config);
  } else {
    throw new Error('Please specify WALLET_SEED_FILE or WALLET_MNEMONIC_FILE (and not both!)');
  }
};

const loadSeedFromMnemonic = async (
  config: BaseConfig,
  log: FastifyBaseLogger,
): Promise<string> => {
  const mnemonic = await readFileOrError(
    config.WALLET_MNEMONIC_FILE!,
    'Failed to read or process wallet mnemonic from',
  );
  const words = mnemonic.trim().split(/\s+/);
  if (!bip39.validateMnemonic(words.join(' '), english)) {
    throw new Error('Invalid mnemonic phrase');
  }
  const fullSeed = await bip39.mnemonicToSeed(words.join(' '));
  log.debug(`BIP39 mnemonic to seed: ${Buffer.from(fullSeed).toString('hex')}`);
  const truncatedSeed = fullSeed.slice(0, 32);
  log.debug(`Sliced seed (for Lace): ${Buffer.from(truncatedSeed).toString('hex')}`);
  return Buffer.from(truncatedSeed).toString('hex');
};

const loadSeedFromFile = async (config: BaseConfig): Promise<string> => {
  const seed = await readFileOrError(config.WALLET_SEED_FILE!, 'Failed to read wallet seed from');
  return seed.trim();
};

export const getPriceFormulas = async (priceFormulasFile: string): Promise<PriceFormula[]> => {
  const priceFormulasStr = await readFileOrError(
    priceFormulasFile,
    'Failed to read price formula data from',
  );
  return JSON.parse(priceFormulasStr).prices;
};

export const getDustWalletState = async (
  dustWalletStateFile: string,
  log: FastifyBaseLogger,
): Promise<string | undefined> => {
  return readFileOrUndefined(dustWalletStateFile, log);
};

const readFileOrError = async (filePath: string, errorMessagePrefix: string): Promise<string> => {
  try {
    const fullPath = path.resolve(process.cwd(), filePath);
    return await fs.readFile(fullPath, 'utf-8');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`${errorMessagePrefix} ${filePath}: ${message}`);
  }
};

const readFileOrUndefined = async (
  filePath: string,
  log: FastifyBaseLogger,
): Promise<string | undefined> => {
  try {
    const fullPath = path.resolve(process.cwd(), filePath);
    const content = await fs.readFile(fullPath, 'utf-8');
    log.info(`File loaded from ${filePath}`);
    return content;
  } catch (e) {
    log.info(`No file found at ${filePath}`);
    return undefined;
  }
};
