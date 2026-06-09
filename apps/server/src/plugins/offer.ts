import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { OfferService } from '../services/offer.js';

declare module 'fastify' {
  interface FastifyInstance {
    offerService: OfferService;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  if (!fastify.utxoService) {
    throw new Error("OfferService requires UtxoService to be init'd first");
  }
  if (!fastify.txService) {
    throw new Error("OfferService requires TxService to be init'd first");
  }
  if (!fastify.priceService) {
    throw new Error("OfferService requires PriceService to be init'd first");
  }
  if (!fastify.metricsService) {
    throw new Error("OfferService requires MetricsService to be init'd first");
  }

  const service = new OfferService(
    fastify.utxoService,
    fastify.txService,
    fastify.priceService,
    fastify.metricsService,
    fastify.config.offerTtlSeconds,
    fastify.log,
  );
  fastify.decorate('offerService', service);
  fastify.log.info("OfferService init'd");
});
