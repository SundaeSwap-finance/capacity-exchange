import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { ChainStateService } from '../services/chain-state.js';

declare module 'fastify' {
  interface FastifyInstance {
    chainStateService: ChainStateService;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  const service = new ChainStateService(fastify.config.endpoints.indexerHttpUrl, fastify.log);
  await service.start();

  fastify.decorate('chainStateService', service);

  fastify.addHook('onClose', (instance, done) => {
    instance.chainStateService.stop();
    done();
  });

  fastify.log.info("ChainStateService init'd and started");
});
