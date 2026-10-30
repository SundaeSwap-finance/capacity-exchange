import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { CardanoOfferReply, CardanoOfferSchema } from '../../models/offer';

const offerRoutes: FastifyPluginAsyncTypebox = async (fastify, _opts) => {
  // this endpoint accepts application/cbor only
  fastify.removeContentTypeParser('application/json');
  fastify.addContentTypeParser(
    'application/cbor',
    { parseAs: 'buffer', bodyLimit: 64 * 1024 },
    (_request, body, done) => done(null, body),
  );

  fastify.post<{
    Body: Buffer;
    Reply: typeof CardanoOfferReply.static;
  }>(
    '/offers',
    {
      ...CardanoOfferSchema,
      // disable validation because we're expecting a raw buffer
      validatorCompiler: () => () => true,
    },
    async (request, reply) => {
      if (!fastify.cardanoOfferService) {
        return reply.notImplemented('Cardano offers are not configured on this server');
      }

      const result = await fastify.cardanoOfferService.createOffer(request.body);
      if (result.status === 'unsupported-version') {
        return reply.code(400).send({
          error: 'unsupported-version',
          message: 'Unsupported version',
        });
      }
      if (result.status === 'malformed') {
        return reply.code(400).send({
          error: 'malformed',
          message: result.reason,
        });
      }
      if (result.status === 'over-budget') {
        return reply.code(400).send({
          error: 'over-budget',
          message: 'exceeds the available budget',
        });
      }
      return reply.code(202).send(result.response);
    },
  );
};

export default offerRoutes;
