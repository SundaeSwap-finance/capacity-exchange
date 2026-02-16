import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { TxService } from '../services/tx';
import { deriveKeys } from '../utils/keys';

declare module 'fastify' {
  interface FastifyInstance {
    txService: TxService;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  const { WALLET_SEED, MIDNIGHT_NETWORK, PROOF_SERVER_URL } = fastify.config;
  const { zswap } = await deriveKeys(WALLET_SEED);
  const txService = new TxService(MIDNIGHT_NETWORK, zswap, PROOF_SERVER_URL);
  fastify.decorate('txService', txService);
});
