import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { CreateOfferRequest, OfferReply, OfferSchema } from '../models/offer.js';

const offerRoutes: FastifyPluginAsyncTypebox = async (fastify, _opts) => {
  fastify.post<{
    Body: typeof CreateOfferRequest.static;
    Reply: typeof OfferReply.static;
  }>('/offers', OfferSchema, async (request, reply) => {
    const result = await fastify.offerService.createOffer(request.body);

    switch (result.status) {
      case 'ok':
        return reply.code(201).send(result.offer);
      case 'insufficient-funds':
        return reply.conflict(`Insufficient specks available for request of ${result.requested}`);
      case 'wallet-syncing':
        return reply.serviceUnavailable(
          "Wallet is currently sync'ing with the network. Please try again shortly.",
        );
      case 'wallet-sync-failed':
        return reply.internalServerError(
          'Wallet sync failed. The service is unable to process requests.',
          result.error,
        );
      case 'unsupported-currency':
        return reply.badRequest(`Unsupported currency: ${result.currency}`);
      case 'illegal-state':
        return reply.internalServerError('Service is in an illegal state.', result.error);
    }
  });
};

export default offerRoutes;
