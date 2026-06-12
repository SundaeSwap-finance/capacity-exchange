import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { CardanoUtxoService } from '../services/cardanoUtxo.js';

declare module 'fastify' {
  interface FastifyInstance {
    cardanoUtxoService: CardanoUtxoService | null;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  const {
    blockfrostApiKey: apiKey,
    blockfrostBaseUrl: baseUrl,
    cardanoServerAddress: serverAddress,
  } = fastify.config;

  const service =
    apiKey && baseUrl && serverAddress
      ? new CardanoUtxoService(apiKey, baseUrl, fastify.log, serverAddress)
      : null;

  fastify.decorate('cardanoUtxoService', service);

  if (service) {
    fastify.log.info("CardanoUtxoService init'd");
  } else {
    fastify.log.debug(
      'CardanoUtxoService not configured (BLOCKFROST_API_KEY, BLOCKFROST_BASE_URL, and CARDANO_SERVER_ADDRESS must all be set)',
    );
  }
});
