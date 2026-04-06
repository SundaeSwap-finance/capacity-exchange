import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { MetricsService } from '../services/metrics.js';

declare module 'fastify' {
  interface FastifyInstance {
    metricsService: MetricsService;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  if (!fastify.utxoService) {
    throw new Error("MetricsService requires UtxoService to be init'd first");
  }
  if (!fastify.walletService) {
    throw new Error("MetricsService requires WalletService to be init'd first");
  }

  const service = new MetricsService(fastify.utxoService, fastify.walletService);
  fastify.decorate('metricsService', service);
  fastify.log.info("MetricsService init'd");
});
