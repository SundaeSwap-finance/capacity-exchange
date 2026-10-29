import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { CardanoService } from '../services/cardano.js';

declare module 'fastify' {
  interface FastifyInstance {
    cardanoService: CardanoService | null;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  const {
    blockfrostApiKey: apiKey,
    blockfrostBaseUrl: baseUrl,
    cardanoWalletAddress: walletAddress,
  } = fastify.config;

  const service =
    apiKey && baseUrl && walletAddress
      ? new CardanoService(apiKey, baseUrl, fastify.log, walletAddress)
      : null;

  fastify.decorate('cardanoService', service);

  if (service) {
    fastify.log.info("CardanoService init'd");
  } else {
    fastify.log.debug(
      'CardanoService not configured (CARDANO_BLOCKFROST_API_KEY, CARDANO_BLOCKFROST_BASE_URL, and CARDANO_SERVER_ADDRESS must all be set)',
    );
  }
});
