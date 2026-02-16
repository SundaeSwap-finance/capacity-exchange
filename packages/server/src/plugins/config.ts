import { createHash } from 'node:crypto';
import fp from 'fastify-plugin';
import fastifyEnv from '@fastify/env';
import { FastifyInstance } from 'fastify';
import { AppConfig, BaseConfig, schema } from '../models/config.js';
import { getPriceFormulas, getWalletSeed, getDustWalletState } from '../utils/config.js';
import { buildWalletContext } from '../utils/wallet.js';

declare module 'fastify' {
  interface FastifyInstance {
    config: AppConfig;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  const dotenvOptions = process.env.DOTENV_CONFIG_PATH
    ? { path: process.env.DOTENV_CONFIG_PATH, debug: true }
    : { debug: true };

  const options = {
    confKey: 'config',
    schema,
    dotenv: dotenvOptions,
    data: process.env,
  };
  await fastify.register(fastifyEnv, options);

  // This is the merge of all the env vars
  const baseConfig = fastify.config as unknown as BaseConfig;
  fastify.log.debug({ baseConfig });

  const walletSeed = await getWalletSeed(baseConfig, fastify.log);

  // Compute state file path from seed hash
  const seedHash = createHash('sha256').update(walletSeed, 'hex').digest('hex');
  const dustWalletStateFile = `dust-wallet-state-${seedHash}.data`;

  const [priceFormulas, walletState] = await Promise.all([
    getPriceFormulas(baseConfig.PRICE_FORMULAS_FILE),
    getDustWalletState(dustWalletStateFile, fastify.log),
  ]);

  const walletContext = buildWalletContext(baseConfig, walletSeed, walletState);

  // Transform BaseConfig to the more useful AppConfig (incls a built WalletContext)
  const appConfig: AppConfig = {
    ...baseConfig,
    WALLET_SEED: walletSeed,
    DUST_WALLET_STATE_FILE: dustWalletStateFile,
    PRICE_FORMULAS: priceFormulas,
    walletContext,
  };

  fastify.config = appConfig;
});
