import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { SponsorService } from '../services/sponsor.js';

declare module 'fastify' {
  interface FastifyInstance {
    sponsorService: SponsorService;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  if (!fastify.utxoService) {
    throw new Error("SponsorService requires UtxoService to be init'd first");
  }
  if (!fastify.txService) {
    throw new Error("SponsorService requires TxService to be init'd first");
  }
  if (!fastify.metricsService) {
    throw new Error("SponsorService requires MetricsService to be init'd first");
  }

  const service = new SponsorService(
    fastify.utxoService,
    fastify.txService,
    fastify.metricsService,
    fastify.config.sponsorAll ?? false,
    fastify.config.sponsoredContracts,
    fastify.config.endpoints.indexerHttpUrl,
    fastify.log,
    fastify.config.cesWalletProvider,
  );
  fastify.decorate('sponsorService', service);
  fastify.log.info("SponsorService init'd");
});
