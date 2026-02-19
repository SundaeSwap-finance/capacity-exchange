import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { TxService } from '../services/tx.js';

declare module 'fastify' {
  interface FastifyInstance {
    txService: TxService;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  const { MIDNIGHT_NETWORK, endpoints, walletConnection } = fastify.config;
  const txService = new TxService(
    MIDNIGHT_NETWORK,
    walletConnection.keys.shieldedSecretKeys,
    endpoints.proofServerUrl,
  );
  fastify.decorate('txService', txService);
});
