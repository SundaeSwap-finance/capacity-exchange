import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { SponsorService } from '../services/sponsor.js';

declare module 'fastify' {
  interface FastifyInstance {
    sponsorService: SponsorService | null;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  if (!fastify.utxoService || !fastify.txService) {
    fastify.decorate('sponsorService', null);
    fastify.log.debug('SponsorService not configured (no Midnight network configured)');
    return;
  }
  if (!fastify.metricsService) {
    throw new Error("SponsorService requires MetricsService to be init'd first");
  }

  if (!fastify.chainStateService) {
    throw new Error("SponsorService requires ChainStateService to be init'd first");
  }

  const service = new SponsorService(
    fastify.utxoService,
    fastify.txService,
    fastify.metricsService,
    fastify.chainStateService,
    fastify.config.sponsorAll ?? false,
    fastify.config.sponsoredContracts,
    fastify.log,
    fastify.cesWalletProvider,
  );
  fastify.decorate('sponsorService', service);
  fastify.log.info("SponsorService init'd");
});
