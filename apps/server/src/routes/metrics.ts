import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { MetricsSchema } from '../models/metrics.js';
import { packageName, packageVersion } from '../packageInfo.js';

const metricsRoutes: FastifyPluginAsyncTypebox = async (fastify, _opts) => {
  fastify.get('/metrics', MetricsSchema, async (_request, _reply) => {
    return {
      server: {
        name: packageName,
        version: packageVersion,
        uptime: process.uptime(),
      },
      ...fastify.metricsService.getMetrics(),
    };
  });
};

export default metricsRoutes;
