import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { MetricsSchema } from '../models/metrics.js';
import { packageName, packageVersion } from '../packageInfo.js';

const metricsRoutes: FastifyPluginAsyncTypebox = async (fastify, _opts) => {
  fastify.get('/metrics', MetricsSchema, async (_request, _reply) => {
    const walletSyncState = fastify.walletService.syncState;

    const businessMetrics = fastify.metricsService.getMetrics();

    return {
      server: {
        name: packageName,
        version: packageVersion,
        uptime: process.uptime(),
        network: fastify.config.networkId,
      },
      health: {
        wallet: walletSyncState,
      },
      ...businessMetrics,
    };
  });
};

export default metricsRoutes;
