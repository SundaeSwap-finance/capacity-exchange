import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { MidnightPricesSchema, PricesSchema } from '../models/prices.js';
import type { CapacityAsset } from '../config/prices.js';
import { feeUnitSpecks } from '../services/midnight/fee-unit.js';

/** Quotes `amount` of `asset` in every currency this server accepts for it. */
export function replyWithPrices(
  fastify: FastifyInstance,
  reply: FastifyReply,
  asset: CapacityAsset,
  amount: bigint,
) {
  // DUST offers must also pay the fees the offer itself adds to the client's tx.
  const specks = asset === 'DUST' ? amount + offerFeeOverhead(fastify) : amount;
  const prices = fastify.priceService.listPrices(asset, specks);
  if (!prices) {
    return reply.badRequest(
      `This server does not sell ${asset} capacity (available: ${fastify.priceService.listAssets().join(', ')})`,
    );
  }

  const quoteId = fastify.quoteService.createQuote(asset, specks, prices);
  return reply.status(200).send({ quoteId, prices });
}

/** The configured offer fee overhead, priced at current ledger parameters. */
function offerFeeOverhead(fastify: FastifyInstance): bigint {
  const { midnight, offerFeeOverheadUnits } = fastify.config;
  if (!midnight || !fastify.midnightChainStateService) {
    return 0n;
  }
  const unit = feeUnitSpecks(fastify.midnightChainStateService.ledgerParameters());
  return BigInt(offerFeeOverheadUnits) * unit;
}

const priceRoutes: FastifyPluginAsyncTypebox = async (fastify, _opts) => {
  fastify.get('/prices', PricesSchema, async (request, reply) =>
    replyWithPrices(fastify, reply, request.query.currency, BigInt(request.query.amount)),
  );
};

export default priceRoutes;

/** `GET /prices` for DUST; register it under `/api/midnight`. */
export const midnightPriceRoutes: FastifyPluginAsyncTypebox = async (fastify, _opts) => {
  fastify.get('/prices', MidnightPricesSchema, async (request, reply) =>
    replyWithPrices(fastify, reply, 'DUST', BigInt(request.query.amount)),
  );
};
