import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { MidnightOfferService } from '../../services/midnight/offer.js';

declare module 'fastify' {
  interface FastifyInstance {
    midnightOfferService: MidnightOfferService | null;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  if (!fastify.midnightUtxoService || !fastify.midnightTxService) {
    fastify.decorate('midnightOfferService', null);
    fastify.log.debug('MidnightOfferService not configured (no Midnight network configured)');
    return;
  }
  if (!fastify.priceService) {
    throw new Error("MidnightOfferService requires PriceService to be init'd first");
  }
  const service = new MidnightOfferService(
    fastify.midnightUtxoService,
    fastify.midnightTxService,
    fastify.priceService,
    fastify.metricsService,
    fastify.config.offerTtlSeconds,
    fastify.log,
  );
  fastify.decorate('midnightOfferService', service);
  fastify.log.info("MidnightOfferService init'd");
});
