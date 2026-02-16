import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { PricesSchema } from '../models/prices.js';

const priceRoutes: FastifyPluginAsyncTypebox = async (fastify, _opts) => {
  fastify.get('/prices', PricesSchema, async (request, reply) => {
    const prices = fastify.priceService.listPrices(BigInt(request.query.specks));
    return reply.status(200).send({ prices });
  });
};

export default priceRoutes;
