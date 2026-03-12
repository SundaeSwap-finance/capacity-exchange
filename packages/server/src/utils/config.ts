import { FastifyBaseLogger } from 'fastify';
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseSeedHex, parseMnemonic, uint8ArrayToHex } from '@capacity-exchange/midnight-core';
import { loadWalletSeedFromFile } from '@capacity-exchange/midnight-node';
import { BaseConfig, PriceConfig, PriceConfigSchema } from '../models/config.js';
import { Value } from '@sinclair/typebox/value';

export const getWalletSeed = async (
  baseConfig: BaseConfig,
  log: FastifyBaseLogger,
): Promise<string> => {
  if (baseConfig.WALLET_SEED_FILE && baseConfig.WALLET_MNEMONIC_FILE) {
    throw new Error("Can't specify both WALLET_SEED_FILE and WALLET_MNEMONIC_FILE");
  }

  if (baseConfig.WALLET_MNEMONIC_FILE) {
    log.info(`Loading wallet from mnemonic file: ${baseConfig.WALLET_MNEMONIC_FILE}`);
    const mnemonic = await readFileOrError(baseConfig.WALLET_MNEMONIC_FILE, 'Failed to read wallet mnemonic from');
    return uint8ArrayToHex(parseMnemonic(mnemonic));
  }

  if (baseConfig.WALLET_SEED_FILE) {
    log.info(`Loading wallet from seed file: ${baseConfig.WALLET_SEED_FILE}`);
    const seedStr = await readFileOrError(baseConfig.WALLET_SEED_FILE, 'Failed to read wallet seed from');
    parseSeedHex(seedStr);
    return seedStr.trim();
  }

  if (baseConfig.MIDNIGHT_NETWORK.toLowerCase() === 'mainnet') {
    throw new Error('WALLET_MNEMONIC_FILE or WALLET_SEED_FILE is required on mainnet');
  }

  log.info(`Loading wallet via wallet-mnemonic.${baseConfig.MIDNIGHT_NETWORK}.txt (walk-up)`);
  return uint8ArrayToHex(loadWalletSeedFromFile(baseConfig.MIDNIGHT_NETWORK));
};

export const getPriceConfig = async (priceConfigFile: string): Promise<PriceConfig> => {
  const raw = await readFileOrError(
    priceConfigFile,
    'Failed to read config price config data from',
  );

  try {
    return Value.Decode(PriceConfigSchema, JSON.parse(raw));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid price config in ${priceConfigFile}: ${message}`);
  }
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
