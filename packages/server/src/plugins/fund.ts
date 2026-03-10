import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { FundService } from '../services/fund.js';

declare module 'fastify' {
  interface FastifyInstance {
    fundService: FundService;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  if (!fastify.utxoService) {
    throw new Error("FundService requires UtxoService to be init'd first");
  }
  if (!fastify.txService) {
    throw new Error("FundService requires TxService to be init'd first");
  }

  const service = new FundService(
    fastify.utxoService,
    fastify.txService,
    fastify.config.FUNDED_CONTRACTS,
    fastify.config.endpoints.indexerHttpUrl,
    fastify.log,
  );
  fastify.decorate('fundService', service);
  fastify.log.info("FundService init'd");
});
