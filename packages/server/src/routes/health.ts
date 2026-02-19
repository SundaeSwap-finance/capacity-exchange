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
      // Check that we can reach the config'd indexer
      const indexerStatus = await checkIndexer(fastify.config.endpoints.indexerHttpUrl);

      // Check wallet sync status
      const walletStatus = fastify.walletService.syncState;
      const isIndexerReady = indexerStatus.status === 'ok';
      const isWalletReady = walletStatus.status === 'ok';

      // If either failed, return 500
      if (!isIndexerReady || walletStatus.status === 'ko') {
        reply.status(500);
        return { status: 'ko' as const, wallet: walletStatus, indexer: indexerStatus };
      }

      // The indexer is ready but the wallet sync isn't, return 503
      if (!isWalletReady) {
        reply.status(503);
        return { status: 'syncing' as const, wallet: walletStatus, indexer: indexerStatus };
      }

      return { status: 'ok' as const, wallet: walletStatus, indexer: indexerStatus };
    },
  );
};

export default healthRoutes;
