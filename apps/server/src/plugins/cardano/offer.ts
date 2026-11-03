import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { CardanoOfferService } from '../../services/cardano/offer';

declare module 'fastify' {
  interface FastifyInstance {
    cardanoOfferService: CardanoOfferService | null;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  if (!fastify.cardanoWalletService || !fastify.cardanoChainStateService) {
    fastify.decorate('cardanoOfferService', null);
    fastify.log.debug('CardanoOfferService not configured');
    return;
  }
  const service = new CardanoOfferService(
    fastify.cardanoWalletService,
    fastify.cardanoChainStateService,
  );
  fastify.decorate('cardanoOfferService', service);
  fastify.log.info("CardanoOfferService init'd");
});
