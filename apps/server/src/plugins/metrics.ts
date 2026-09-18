import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { MetricsService } from '../services/metrics.js';

declare module 'fastify' {
  interface FastifyInstance {
    metricsService: MetricsService | null;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  if (!fastify.utxoService || !fastify.walletService) {
    fastify.decorate('metricsService', null);
    fastify.log.debug('MetricsService not configured (no Midnight network configured)');
    return;
  }

  const service = new MetricsService(fastify.utxoService, fastify.walletService);
  fastify.decorate('metricsService', service);
  fastify.log.info("MetricsService init'd");
});
