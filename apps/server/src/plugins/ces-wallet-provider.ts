import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import type { WalletProvider } from '@midnight-ntwrk/midnight-js-types';
import { buildCesWalletProvider } from '../config/cesWalletProvider.js';

declare module 'fastify' {
  interface FastifyInstance {
    cesWalletProvider: WalletProvider | null;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  if (!fastify.walletService) {
    throw new Error("CesWalletProviderPlugin requires WalletService to be init'd first");
  }

  const cesWalletProvider = buildCesWalletProvider(
    fastify.walletService,
    fastify.config.endpoints,
    fastify.config.capacityExchangeUrls,
    fastify.log,
  );

  fastify.decorate('cesWalletProvider', cesWalletProvider);
  fastify.log.info(
    cesWalletProvider
      ? "CES wallet provider init'd"
      : 'No CAPACITY_EXCHANGE_PEER_URLS configured to initialize CES wallet provider',
  );
});
