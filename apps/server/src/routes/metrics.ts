import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { MetricsSchema } from '../models/metrics.js';
import { packageName, packageVersion } from '../packageInfo.js';
import type { BusinessMetrics } from '../services/metrics.js';

// No Midnight network configured (e.g. an ADA-only server): nothing has happened
// on the DUST side, so the zero state is a faithful answer, not a placeholder.
const DISABLED_METRICS: BusinessMetrics = {
  dustUsage: {
    availableBalance: '0',
    totalSpecksConsumed: '0',
    specksLastHour: '0',
    locksLastHour: 0,
  },
  revenue: { byCurrency: {} },
  contention: {
    lockedUtxos: 0,
    totalUtxos: 0,
    lockedSpecks: '0',
    ratio: 0,
    averageRatioLastHour: 0,
  },
};

const metricsRoutes: FastifyPluginAsyncTypebox = async (fastify, _opts) => {
  fastify.get('/metrics', MetricsSchema, async (_request, _reply) => {
    const walletSyncState = fastify.walletService?.syncState ?? { status: 'disabled' as const };

    const businessMetrics = fastify.metricsService?.getMetrics() ?? DISABLED_METRICS;

    return {
      server: {
        name: packageName,
        version: packageVersion,
        uptime: process.uptime(),
        network: fastify.config.midnight?.networkId ?? null,
      },
      health: {
        wallet: walletSyncState,
      },
      ...businessMetrics,
    };
  });
};

export default metricsRoutes;
