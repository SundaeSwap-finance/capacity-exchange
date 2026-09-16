import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { PricesSchema } from '../models/prices.js';

const priceRoutes: FastifyPluginAsyncTypebox = async (fastify, _opts) => {
  fastify.get('/prices', PricesSchema, async (request, reply) => {
    const asset = request.query.currency;
    const amount = BigInt(request.query.amount);

    const prices = fastify.priceService.listPrices(asset, amount);
    if (!prices) {
      return reply.badRequest(
        `This server does not sell ${asset} capacity (available: ${fastify.priceService.listAssets().join(', ')})`,
      );
    }

    const quoteId = fastify.quoteService.createQuote(asset, amount, prices);
    return reply.status(200).send({ quoteId, prices });
  });
};

export default priceRoutes;
