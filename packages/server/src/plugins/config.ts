import fp from 'fastify-plugin';
import fastifyEnv from '@fastify/env';
import { FastifyInstance } from 'fastify';
import {
  resolveEndpoints,
  resolveWalletConfig,
  toNetworkIdEnum,
  createWallet,
  WalletStateStore,
  deriveWalletKeys,
} from '@capacity-exchange/midnight-core';
import { AppConfig, BaseConfig, schema } from '../models/config.js';
import { getPriceConfig, getWalletSeed } from '../utils/config.js';
import { FileStateStore } from '@capacity-exchange/midnight-node';

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
  const keys = deriveWalletKeys(walletSeed, networkId);
  const walletStateStore = new WalletStateStore(
    new FileStateStore(baseConfig.WALLET_STATE_DIR, fastify.log.child({ service: 'StateStore' })),
    String(networkId),
    keys.shieldedSecretKeys.coinPublicKey,
    {
      debounceMs: 1000,
      onFlushError: (err) => fastify.log.error(err, 'Failed to flush wallet state'),
    },
  );

  const [priceConfig, saved] = await Promise.all([
    getPriceConfig(baseConfig.PRICE_CONFIG_FILE),
    walletStateStore.loadWalletState(),
  ]);

  const walletConnection = createWallet({
    seedHex: walletSeed,
    walletConfig: resolveWalletConfig(networkId),
    ...saved,
  });

  fastify.config = {
    ...baseConfig,
    endpoints,
    WALLET_SEED: walletSeed,
    PRICE_FORMULAS: priceConfig.priceFormulas,
    FUNDED_CONTRACTS: priceConfig.fundedContracts,
    walletConnection,
    walletStateStore,
  };
});
