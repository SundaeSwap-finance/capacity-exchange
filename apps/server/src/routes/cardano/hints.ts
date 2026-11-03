import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { CardanoHintsSchema } from '../../models/cardano-hints.js';

const hintRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get('/hints', CardanoHintsSchema, async (_request, reply) => {
    if (!fastify.cardanoHintService) {
      return reply.notImplemented('Cardano price hints are not configured on this server');
    }
    return fastify.cardanoHintService.hints();
  });
};

export default hintRoutes;
