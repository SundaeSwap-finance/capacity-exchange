import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { CardanoChainStateService } from '../services/cardano-chain-state.js';

declare module 'fastify' {
  interface FastifyInstance {
    cardanoChainStateService: CardanoChainStateService | null;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  const url = fastify.config.cardanoUtxorpcUrl;
  if (!url) {
    fastify.decorate('cardanoChainStateService', null);
    fastify.log.debug('CardanoChainStateService not configured (CARDANO_UTXORPC_URL is not set)');
    return;
  }

  const service = new CardanoChainStateService(url, fastify.log);
  service.start();

  fastify.decorate('cardanoChainStateService', service);

  fastify.addHook('onClose', async (instance) => {
    await instance.cardanoChainStateService?.stop();
  });

  fastify.log.info("CardanoChainStateService init'd and started");
});
