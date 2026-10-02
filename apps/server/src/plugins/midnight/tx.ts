import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { MidnightTxService } from '../../services/midnight/tx.js';

declare module 'fastify' {
  interface FastifyInstance {
    midnightTxService: MidnightTxService | null;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  const { midnight } = fastify.config;
  if (!midnight) {
    fastify.decorate('midnightTxService', null);
    fastify.log.debug('MidnightTxService not configured (no Midnight network configured)');
    return;
  }

  const midnightTxService = new MidnightTxService(
    midnight.networkId,
    midnight.walletConnection.keys.shieldedSecretKeys,
    midnight.walletConnection.keys.unshieldedKeystore.getAddress(),
    midnight.endpoints.proofServerUrl,
  );
  fastify.decorate('midnightTxService', midnightTxService);
});
