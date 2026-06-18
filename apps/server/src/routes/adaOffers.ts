import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { AdaCreateOfferRequest, AdaOfferSchema, OfferReply } from '../models/offer.js';
import { replyWithOfferResult } from './offer-helpers.js';

const adaOfferRoutes: FastifyPluginAsyncTypebox = async (fastify, _opts) => {
  fastify.post<{
    Body: typeof AdaCreateOfferRequest.static;
    Reply: typeof OfferReply.static;
  }>('/ada/offers', AdaOfferSchema, async (request, reply) => {
    if (!fastify.cardanoService) {
      return reply.notImplemented('ADA offers are not configured on this server');
    }

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

    const utxoExists = await fastify.cardanoService.verifyPayment({
      txHash: request.body.utxoTxHash,
      senderAddress: request.body.senderAddress,
      sentValue: BigInt(request.body.expectedValue),
    });

    if (!utxoExists) {
      return reply.notFound('Cardano UTXO not found');
    }

    const result = await fastify.offerService.createOffer({
      quoteId: request.body.quoteId,
      specks: quoteResult.quote.amount,
      offerCurrency: request.body.offerCurrency,
    });

    return replyWithOfferResult(reply, result);
  });
};

export default adaOfferRoutes;
