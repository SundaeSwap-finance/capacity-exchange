import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { MidnightSponsorService } from '../../services/midnight/sponsor.js';

declare module 'fastify' {
  interface FastifyInstance {
    midnightSponsorService: MidnightSponsorService | null;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  if (!fastify.midnightUtxoService || !fastify.midnightTxService) {
    fastify.decorate('midnightSponsorService', null);
    fastify.log.debug('MidnightSponsorService not configured (no Midnight network configured)');
    return;
  }
  if (!fastify.midnightChainStateService) {
    throw new Error("MidnightSponsorService requires MidnightChainStateService to be init'd first");
  }

  const service = new MidnightSponsorService(
    fastify.midnightUtxoService,
    fastify.midnightTxService,
    fastify.metricsService,
    fastify.midnightChainStateService,
    fastify.config.sponsorAll ?? false,
    fastify.config.sponsoredContracts,
    fastify.log,
    fastify.cesWalletProvider,
  );
  fastify.decorate('midnightSponsorService', service);
  fastify.log.info("MidnightSponsorService init'd");
});
