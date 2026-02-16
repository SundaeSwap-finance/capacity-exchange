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
  const { walletContext, DUST_WALLET_STATE_FILE, OFFER_TTL_SECONDS } = fastify.config;

  const walletService = new WalletService(walletContext, fastify.log, DUST_WALLET_STATE_FILE);
  await walletService.start();

  const utxoService = new UtxoService(walletService, fastify.log, OFFER_TTL_SECONDS);

  fastify.decorate('walletService', walletService);
  fastify.decorate('utxoService', utxoService);

  fastify.addHook('onClose', (instance, done) => {
    instance.walletService.stop();
    done();
  });

  fastify.log.info("WalletService and UtxoService init'd and started");
});
