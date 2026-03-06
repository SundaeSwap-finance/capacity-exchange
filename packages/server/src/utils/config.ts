import { FastifyBaseLogger } from 'fastify';
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseSeedHex, parseMnemonic, uint8ArrayToHex } from '@capacity-exchange/midnight-core';
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
    return loadSeedFromMnemonic(config);
  } else if (config.WALLET_SEED_FILE) {
    log.info(`Loading wallet from seed: ${config.WALLET_SEED_FILE}`);
    return loadSeedFromFile(config);
  } else {
    throw new Error('Please specify WALLET_SEED_FILE or WALLET_MNEMONIC_FILE (and not both!)');
  }
};

const loadSeedFromMnemonic = async (config: BaseConfig): Promise<string> => {
  const mnemonic = await readFileOrError(
    config.WALLET_MNEMONIC_FILE!,
    'Failed to read or process wallet mnemonic from',
  );
  const seed = parseMnemonic(mnemonic);
  return uint8ArrayToHex(seed);
};

const loadSeedFromFile = async (config: BaseConfig): Promise<string> => {
  const seedStr = await readFileOrError(
    config.WALLET_SEED_FILE!,
    'Failed to read wallet seed from',
  );
  // Validate it's valid hex by parsing, then return the original trimmed string
  parseSeedHex(seedStr);
  return seedStr.trim();
};

export const getPriceFormulas = async (priceFormulasFile: string): Promise<PriceFormula[]> => {
  const priceFormulasStr = await readFileOrError(
    priceFormulasFile,
    'Failed to read price formula data from',
  );
  return JSON.parse(priceFormulasStr).prices;
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
