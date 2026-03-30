import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { randomBytes } from 'crypto';
import { QuoteService } from '../services/quote.js';

declare module 'fastify' {
  interface FastifyInstance {
    quoteService: QuoteService;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  const service = new QuoteService(fastify.config.quoteTtlSeconds, randomBytes(32));
  fastify.decorate('quoteService', service);
  fastify.log.info("QuoteService init'd");
});
