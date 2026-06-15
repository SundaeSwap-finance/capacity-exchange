import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { CreateOfferRequest, OfferReply, OfferSchema } from '../models/offer.js';
import { replyWithOfferResult } from './offer-helpers.js';

const offerRoutes: FastifyPluginAsyncTypebox = async (fastify, _opts) => {
  fastify.post<{
    Body: typeof CreateOfferRequest.static;
    Reply: typeof OfferReply.static;
  }>('/offers', OfferSchema, async (request, reply) => {
    const quoteResult = fastify.quoteService.getQuote(request.body.quoteId);
    if (quoteResult.status === 'invalid') {
      return reply.badRequest('Invalid quote ID');
    }
    if (quoteResult.status === 'expired') {
      return reply.gone('Quote has expired. Please request a new price quote.');
    }
    if (quoteResult.quote.currency !== 'DUST') {
      return reply.badRequest('Invalid currency');
    }

    const result = await fastify.offerService.createOffer({
      quoteId: request.body.quoteId,
      specks: quoteResult.quote.amount,
      offerCurrency: request.body.offerCurrency,
    });

    return replyWithOfferResult(reply, result);
  });
};

export default offerRoutes;
