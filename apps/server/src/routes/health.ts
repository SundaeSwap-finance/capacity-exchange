import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { checkIndexer } from '../utils/health.js';
import { HealthSchema, ReadinessSchema, ReadyResponse } from '../models/health.js';

const healthRoutes: FastifyPluginAsyncTypebox = async (fastify, _opts) => {
  // Simple health check
  fastify.get('/', HealthSchema, async () => {
    return { status: 'ok' as const, uptime: process.uptime() };
  });

  // Readiness check
  // TODO: Add checks for proof-server readiness
  fastify.get(
    '/ready',
    ReadinessSchema,
    async (_request, reply): Promise<typeof ReadyResponse.static> => {
      const cardano = fastify.cardanoChainStateService?.health();

      let midnight: typeof ReadyResponse.static.midnight;
      if (fastify.config.midnight && fastify.midnightWalletService) {
        const indexer = await checkIndexer(fastify.config.midnight.endpoints.indexerHttpUrl);
        midnight = { wallet: fastify.midnightWalletService.syncState, indexer };
      }

      // Cardano is reported but does not gate readiness: no route depends on it.
      const statuses = midnight ? [midnight.indexer.status, midnight.wallet.status] : [];
      if (statuses.includes('ko')) {
        reply.status(500);
        return { status: 'ko' as const, midnight, cardano };
      }
      if (statuses.includes('syncing')) {
        reply.status(503);
        return { status: 'syncing' as const, midnight, cardano };
      }
      return { status: 'ok' as const, midnight, cardano };
    },
  );
};

export default healthRoutes;
