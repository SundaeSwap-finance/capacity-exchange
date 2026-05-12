import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { WalletService } from '../services/wallet.js';
import { UtxoService } from '../services/utxo.js';

declare module 'fastify' {
  interface FastifyInstance {
    walletService: WalletService;
    utxoService: UtxoService;
  }
}

// TODO: Wrt wallet and offer, we can split-up this plugin later
export default fp(async (fastify: FastifyInstance) => {
  if (!fastify.chainStateService) {
    throw new Error("UtxoService requires ChainStateService to be init'd first");
  }

  const { walletConnection, walletStateStore, offerTtlSeconds } = fastify.config;

  const walletService = new WalletService(walletConnection, fastify.log, walletStateStore);
  await walletService.start();

  const utxoService = new UtxoService(
    walletService,
    fastify.chainStateService,
    fastify.log,
    offerTtlSeconds,
  );

  fastify.decorate('walletService', walletService);
  fastify.decorate('utxoService', utxoService);

  fastify.addHook('onClose', (instance, done) => {
    instance.walletService.stop();
    done();
  });

  fastify.log.info("WalletService and UtxoService init'd and started");
});
