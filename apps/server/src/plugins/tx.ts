import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { TxService } from '../services/tx.js';

declare module 'fastify' {
  interface FastifyInstance {
    txService: TxService | null;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  const { midnight } = fastify.config;
  if (!midnight) {
    fastify.decorate('txService', null);
    fastify.log.debug('TxService not configured (no Midnight network configured)');
    return;
  }

  const txService = new TxService(
    midnight.networkId,
    midnight.walletConnection.keys.shieldedSecretKeys,
    midnight.walletConnection.keys.unshieldedKeystore.getAddress(),
    midnight.endpoints.proofServerUrl,
  );
  fastify.decorate('txService', txService);
});
