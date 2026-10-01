import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { MidnightWalletService } from '../../services/midnight/wallet.js';
import { MidnightUtxoService } from '../../services/midnight/utxo.js';

declare module 'fastify' {
  interface FastifyInstance {
    midnightWalletService: MidnightWalletService | null;
    midnightUtxoService: MidnightUtxoService | null;
  }
}

// TODO: Wrt wallet and offer, we can split-up this plugin later
export default fp(async (fastify: FastifyInstance) => {
  const { midnight, offerTtlSeconds } = fastify.config;

  if (!midnight) {
    fastify.decorate('midnightWalletService', null);
    fastify.decorate('midnightUtxoService', null);
    fastify.log.debug(
      'MidnightWalletService/MidnightUtxoService not configured (no Midnight network configured)',
    );
    return;
  }

  if (!fastify.midnightChainStateService) {
    throw new Error("MidnightUtxoService requires MidnightChainStateService to be init'd first");
  }

  const midnightWalletService = new MidnightWalletService(
    midnight.walletConnection,
    fastify.log,
    midnight.walletStateStore,
  );
  await midnightWalletService.start();

  const midnightUtxoService = new MidnightUtxoService(
    midnightWalletService,
    fastify.midnightChainStateService,
    fastify.log,
    offerTtlSeconds,
  );

  fastify.decorate('midnightWalletService', midnightWalletService);
  fastify.decorate('midnightUtxoService', midnightUtxoService);

  fastify.addHook('onClose', (instance, done) => {
    instance.midnightWalletService?.stop();
    done();
  });

  fastify.log.info("MidnightWalletService and MidnightUtxoService init'd and started");
});
