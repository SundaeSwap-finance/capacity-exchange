import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { randomBytes } from 'crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { QuoteService } from '../services/quote.js';

declare module 'fastify' {
  interface FastifyInstance {
    quoteService: QuoteService;
  }
}

/** Load signing secret from file, or generate and persist a new one. */
function loadOrCreateSecret(filePath: string, logger: FastifyInstance['log']): Buffer {
  if (existsSync(filePath)) {
    logger.info({ path: filePath }, 'Loaded quote signing secret');
    return Buffer.from(readFileSync(filePath, 'utf-8').trim(), 'hex');
  }
  const secret = randomBytes(32);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, secret.toString('hex'), 'utf-8');
  logger.info({ path: filePath }, 'Generated and persisted quote signing secret');
  return secret;
}

export default fp(async (fastify: FastifyInstance) => {
  const secret = loadOrCreateSecret(fastify.config.quoteSecretFile, fastify.log);
  const service = new QuoteService(fastify.config.quoteTtlSeconds, secret);
  fastify.decorate('quoteService', service);
  fastify.log.info("QuoteService init'd");
});
