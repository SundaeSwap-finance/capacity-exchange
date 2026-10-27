import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { CardanoChainStateService } from '../../services/cardano/chain-state.js';

declare module 'fastify' {
  interface FastifyInstance {
    cardanoChainStateService: CardanoChainStateService | null;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  const cardano = fastify.config.cardano;
  if (!cardano) {
    fastify.decorate('cardanoChainStateService', null);
    fastify.log.debug('CardanoChainStateService not configured (CARDANO_UTXORPC_URL is not set)');
    return;
  }

  const service = new CardanoChainStateService(cardano.utxorpcUrl, fastify.log);

  fastify.decorate('cardanoChainStateService', service);

  fastify.addHook('onReady', async () => {
    service.start();
    fastify.log.info('CardanoChainStateService started');
  });

  fastify.addHook('onClose', async (instance) => {
    await instance.cardanoChainStateService?.stop();
  });

  fastify.log.info("CardanoChainStateService init'd");
});
