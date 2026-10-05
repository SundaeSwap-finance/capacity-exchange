import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { AssetPricesSchema, PricesSchema } from '../models/prices.js';
import type { CapacityAsset } from '../config/prices.js';

/** Quotes `amount` of `asset` in every currency this server accepts for it. */
export function replyWithPrices(
  fastify: FastifyInstance,
  reply: FastifyReply,
  asset: CapacityAsset,
  amount: bigint,
) {
  const prices = fastify.priceService.listPrices(asset, amount);
  if (!prices) {
    return reply.badRequest(
      `This server does not sell ${asset} capacity (available: ${fastify.priceService.listAssets().join(', ')})`,
    );
  }

  const quoteId = fastify.quoteService.createQuote(asset, amount, prices);
  return reply.status(200).send({ quoteId, prices });
}

const priceRoutes: FastifyPluginAsyncTypebox = async (fastify, _opts) => {
  fastify.get('/prices', PricesSchema, async (request, reply) =>
    replyWithPrices(fastify, reply, request.query.currency, BigInt(request.query.amount)),
  );
};

export default priceRoutes;

/** `GET /prices` for one chain's capacity asset; register it under that chain's prefix. */
export function assetPriceRoutes(asset: CapacityAsset): FastifyPluginAsyncTypebox {
  return async (fastify, _opts) => {
    fastify.get('/prices', AssetPricesSchema, async (request, reply) =>
      replyWithPrices(fastify, reply, asset, BigInt(request.query.amount)),
    );
  };
}
