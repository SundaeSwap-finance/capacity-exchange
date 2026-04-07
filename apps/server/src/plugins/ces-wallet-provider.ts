import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import type { WalletProvider } from '@midnight-ntwrk/midnight-js-types';
// import { buildCesWalletProvider } from '../config/cesWalletProvider.js';

declare module 'fastify' {
  interface FastifyInstance {
    cesWalletProvider: WalletProvider | null;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  if (!fastify.walletService) {
    throw new Error("CesWalletProviderPlugin requires WalletService to be init'd first");
  }

  // TODO: renable fallback feature in the future.
  // const cesWalletProvider = buildCesWalletProvider(
  //   fastify.walletService,
  //   fastify.config.endpoints,
  //   fastify.config.capacityExchangeUrls,
  //   fastify.log,
  // );
  const cesWalletProvider = null;

  fastify.decorate('cesWalletProvider', cesWalletProvider);
  fastify.log.trace(
    cesWalletProvider
      ? "CES wallet provider init'd"
      : 'No CAPACITY_EXCHANGE_PEER_URLS configured to initialize CES wallet provider',
  );
});
