import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { MetricsService } from '../services/metrics.js';

declare module 'fastify' {
  interface FastifyInstance {
    metricsService: MetricsService;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  const dust = fastify.midnightUtxoService ?? undefined;
  const service = new MetricsService({ DUST: dust });
  fastify.decorate('metricsService', service);
  fastify.log.info("MetricsService init'd");
});
