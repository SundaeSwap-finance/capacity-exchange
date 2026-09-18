import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { TxService } from '../services/tx.js';

declare module 'fastify' {
  interface FastifyInstance {
    txService: TxService | null;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  const { networkId, endpoints, walletConnection } = fastify.config;
  if (!networkId || !endpoints || !walletConnection) {
    fastify.decorate('txService', null);
    fastify.log.debug('TxService not configured (no Midnight network configured)');
    return;
  }

  const txService = new TxService(
    networkId,
    walletConnection.keys.shieldedSecretKeys,
    walletConnection.keys.unshieldedKeystore.getAddress(),
    endpoints.proofServerUrl,
  );
  fastify.decorate('txService', txService);
});
