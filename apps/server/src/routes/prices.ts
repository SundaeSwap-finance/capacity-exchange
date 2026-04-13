import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { PricesSchema } from '../models/prices.js';

const priceRoutes: FastifyPluginAsyncTypebox = async (fastify, _opts) => {
  fastify.get('/prices', PricesSchema, async (request, reply) => {
    const specks = BigInt(request.query.specks);
    const prices = fastify.priceService.listPrices(specks);
    const quoteId = fastify.quoteService.createQuote(specks, prices);
    // TODO: return full price info
    return reply.status(200).send({
      quoteId,
      prices: prices.map((p) => ({ amount: p.amount, currency: p.currency.identifier })),
    });
  });
};

export default priceRoutes;
