import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { CardanoOfferStatusSchema, SubmitCardanoOfferSchema } from '../../models/cardano-offers.js';
import { OfferRejected, type RejectionCode } from '../../services/cardano/offers.js';

function rejectionStatus(code: RejectionCode): 400 | 409 | 422 {
  switch (code) {
    case 'malformed':
    case 'unsupported-version':
      return 400;
    case 'duplicate':
      return 409;
    default:
      return 422;
  }
}

const cardanoOfferRoutes: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post('/offers', SubmitCardanoOfferSchema, async (request, reply) => {
    if (!fastify.cardanoOfferService) {
      return reply.notImplemented('Cardano offers are not configured on this server');
    }
    try {
      return reply.status(202).send(fastify.cardanoOfferService.submit(request.body.envelope));
    } catch (err) {
      if (err instanceof OfferRejected) {
        return reply
          .status(rejectionStatus(err.code))
          .send({ code: err.code, message: err.message });
      }
      throw err;
    }
  });

  fastify.get('/offers/:offerId', CardanoOfferStatusSchema, async (request, reply) => {
    if (!fastify.cardanoOfferService) {
      return reply.notImplemented('Cardano offers are not configured on this server');
    }
    const status = fastify.cardanoOfferService.status(request.params.offerId);
    if (!status) {
      return reply.notFound(`No offer ${request.params.offerId} at this service`);
    }
    return status;
  });
};

export default cardanoOfferRoutes;
