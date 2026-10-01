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
      const disabled = { status: 'disabled' as const };
      const cardano = fastify.cardanoChainStateService?.health() ?? disabled;

      let wallet: typeof ReadyResponse.static.midnight.wallet = disabled;
      let indexer: typeof ReadyResponse.static.midnight.indexer = disabled;
      if (fastify.config.midnight && fastify.walletService) {
        indexer = await checkIndexer(fastify.config.midnight.endpoints.indexerHttpUrl);
        wallet = fastify.walletService.syncState;
      }

      const statuses = [indexer.status, wallet.status, cardano.status];
      if (statuses.includes('ko')) {
        reply.status(500);
        return { status: 'ko' as const, midnight: { wallet, indexer }, cardano };
      }
      if (statuses.includes('syncing')) {
        reply.status(503);
        return { status: 'syncing' as const, midnight: { wallet, indexer }, cardano };
      }
      return { status: 'ok' as const, midnight: { wallet, indexer }, cardano };
    },
  );
};

export default healthRoutes;
