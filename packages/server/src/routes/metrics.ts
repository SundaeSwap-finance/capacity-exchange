import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { readFileSync } from 'fs';
import { MetricsSchema } from '../models/metrics.js';

const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'));

const metricsRoutes: FastifyPluginAsyncTypebox = async (fastify, _opts) => {
  fastify.get('/metrics', MetricsSchema, async (_request, _reply) => {
    const walletSyncState = fastify.walletService.syncState;

    const businessMetrics = fastify.metricsService.getMetrics();

    return {
      server: {
        name: packageJson.name,
        version: packageJson.version,
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
