import fp from 'fastify-plugin';
import { CardanoWalletService } from '../../services/cardano/wallet';
import { FastifyInstance } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    cardanoWalletService: CardanoWalletService | null;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  const cardano = fastify.config.cardano;
  const chainStateService = fastify.cardanoChainStateService;
  if (!cardano || !chainStateService) {
    fastify.decorate('cardanoWalletService', null);
    fastify.log.debug('CardanoWalletService not configured');
    return;
  }

  const service = new CardanoWalletService(cardano.walletAddress);
  chainStateService.addFollower(service);
  fastify.decorate('cardanoWalletService', service);
  fastify.log.info("CardanoWalletService init'd");
});
