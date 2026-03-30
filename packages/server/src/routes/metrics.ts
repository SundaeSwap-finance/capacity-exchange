import { FastifyPluginAsync } from 'fastify';
import { readFileSync } from 'fs';

const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'));

const metricsRoutes: FastifyPluginAsync = async (fastify, _opts) => {
  fastify.get('/metrics', async (_request, _reply) => {
    const walletSyncState = fastify.walletService.syncState;

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
    };
  });
};

export default metricsRoutes;
