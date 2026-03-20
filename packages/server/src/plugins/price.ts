import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { PriceService } from '../services/price.js';

declare module 'fastify' {
  interface FastifyInstance {
    priceService: PriceService;
  }
}

export default fp((fastify: FastifyInstance) => {
  const { priceFormulas } = fastify.config;

  // TODO: Enforce that the price formulas have hex-strings that identify the
  // midnight-contract-minted token
  const priceService = new PriceService(priceFormulas);
  fastify.decorate('priceService', priceService);
});
