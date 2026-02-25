import fp from 'fastify-plugin';
import fastifyEnv from '@fastify/env';
import { FastifyInstance } from 'fastify';
import {
  resolveEndpoints,
  resolveWalletConfig,
  toNetworkIdEnum,
  createWallet,
} from '@capacity-exchange/core';
import { AppConfig, BaseConfig, schema } from '../models/config.js';
import { getPriceFormulas, getWalletSeed } from '../utils/config.js';
import { createWalletStateStore } from '@capacity-exchange/core/node';

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

  const baseConfig = fastify.config as unknown as BaseConfig;
  const networkId = toNetworkIdEnum(baseConfig.MIDNIGHT_NETWORK);
  const endpoints = resolveEndpoints(networkId);
  endpoints.proofServerUrl = baseConfig.PROOF_SERVER_URL;
  fastify.log.debug({ baseConfig, endpoints });

  const walletSeed = await getWalletSeed(baseConfig, fastify.log);
  const walletStateStore = createWalletStateStore(
    networkId,
    walletSeed,
    fastify.log.child({ service: 'StateStore' }),
    baseConfig.WALLET_STATE_DIR,
  );

  const [priceFormulas, savedDustState] = await Promise.all([
    getPriceFormulas(baseConfig.PRICE_FORMULAS_FILE),
    walletStateStore.load('dust'),
  ]);

  const walletConnection = createWallet({
    seedHex: walletSeed,
    walletConfig: resolveWalletConfig(networkId),
    savedDustState,
  });

  fastify.config = {
    ...baseConfig,
    endpoints,
    WALLET_SEED: walletSeed,
    PRICE_FORMULAS: priceFormulas,
    walletConnection,
    walletStateStore,
  };
});
