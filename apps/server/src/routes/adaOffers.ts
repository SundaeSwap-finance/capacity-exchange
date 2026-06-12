import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { AdaCreateOfferRequest, AdaOfferSchema, OfferReply } from '../models/offer.js';

const adaOfferRoutes: FastifyPluginAsyncTypebox = async (fastify, _opts) => {
  fastify.post<{
    Body: typeof AdaCreateOfferRequest.static;
    Reply: typeof OfferReply.static;
  }>('/ada/offers', AdaOfferSchema, async (request, reply) => {
    if (!fastify.cardanoUtxoService) {
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

    const utxoExists = await fastify.cardanoUtxoService.verifyUtxoExists({
      txHash: request.body.utxoTxHash,
      senderAddress: request.body.senderAddress,
      sentValue: BigInt(request.body.expectedValue.minQuantity),
    });

    if (!utxoExists) {
      return reply.notFound('Cardano UTXO not found');
    }

    const result = await fastify.offerService.createOffer({
      quoteId: request.body.quoteId,
      specks: quoteResult.quote.amount,
      offerCurrency: request.body.offerCurrency,
    });

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

export default adaOfferRoutes;
