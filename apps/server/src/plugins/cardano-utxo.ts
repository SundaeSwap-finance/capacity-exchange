import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { CardanoUtxoService } from '../services/cardanoUtxo.js';

declare module 'fastify' {
  interface FastifyInstance {
    cardanoUtxoService: CardanoUtxoService | null;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  const { blockfrostApiKey, blockfrostBaseUrl } = fastify.config;

  const service =
    blockfrostApiKey && blockfrostBaseUrl
      ? new CardanoUtxoService(blockfrostApiKey, blockfrostBaseUrl, fastify.log)
      : null;

  fastify.decorate('cardanoUtxoService', service);

  if (service) {
    fastify.log.info("CardanoUtxoService init'd");
  } else {
    fastify.log.debug('CardanoUtxoService not configured (BLOCKFROST_API_KEY not set)');
  }
});
