import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { MidnightChainStateService } from '../../services/midnight/chain-state.js';

declare module 'fastify' {
  interface FastifyInstance {
    midnightChainStateService: MidnightChainStateService | null;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  if (!fastify.config.midnight) {
    fastify.decorate('midnightChainStateService', null);
    fastify.log.debug('MidnightChainStateService not configured (no Midnight network configured)');
    return;
  }

  const service = new MidnightChainStateService(
    fastify.config.midnight.endpoints.indexerHttpUrl,
    fastify.log,
  );
  // Not awaited on the indexer: the service loads in the background and reports
  // 'syncing' on /health/ready until it has, so a slow indexer can't fail boot.
  service.start();

  fastify.decorate('midnightChainStateService', service);

  fastify.addHook('onClose', (instance, done) => {
    instance.midnightChainStateService?.stop();
    done();
  });

  fastify.log.info("MidnightChainStateService init'd; loading chain state in the background");
});
