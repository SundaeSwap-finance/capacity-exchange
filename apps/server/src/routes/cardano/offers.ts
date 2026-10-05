import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { OfferRejected, type RejectionCode } from '@sundaeswap/capacity-exchange-cardano-tx';
import { CardanoOfferStatusSchema, SubmitCardanoOfferSchema } from '../../models/cardano-offers.js';
import type { Quote } from '../../services/quote.js';

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
  /** A quote for ADA capacity, the only asset this route sells. */
  function adaQuote(quoteId: string): Quote {
    const result = fastify.quoteService.getQuote(quoteId);
    if (result.status === 'invalid') {
      throw new OfferRejected('malformed', 'the quote is not one this service issued');
    }
    if (result.status === 'expired') {
      throw new OfferRejected('expired', 'the quote has expired; request a new one');
    }
    if (result.quote.currency !== 'ADA') {
      throw new OfferRejected('malformed', `the quote is for ${result.quote.currency}, not ADA`);
    }
    return result.quote;
  }

  fastify.post('/offers', SubmitCardanoOfferSchema, async (request, reply) => {
    if (!fastify.cardanoOfferService) {
      return reply.notImplemented('Cardano offers are not configured on this server');
    }
    try {
      const quote = adaQuote(request.body.quoteId);
      return reply
        .status(202)
        .send(fastify.cardanoOfferService.submit(request.body.envelope, quote));
    } catch (err) {
      if (err instanceof OfferRejected) {
        return reply
          .status(rejectionStatus(err.code))
          .send({ code: err.code, message: err.detail });
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
