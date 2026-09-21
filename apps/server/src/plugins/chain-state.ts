import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { ChainStateService } from '../services/chain-state.js';

declare module 'fastify' {
  interface FastifyInstance {
    chainStateService: ChainStateService | null;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  if (!fastify.config.midnight) {
    fastify.decorate('chainStateService', null);
    fastify.log.debug('ChainStateService not configured (no Midnight network configured)');
    return;
  }

  const service = new ChainStateService(
    fastify.config.midnight.endpoints.indexerHttpUrl,
    fastify.log,
  );
  await service.start();

  fastify.decorate('chainStateService', service);

  fastify.addHook('onClose', (instance, done) => {
    instance.chainStateService?.stop();
    done();
  });

  fastify.log.info("ChainStateService init'd and started");
});
