import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { CardanoWalletService } from '../services/cardano/wallet.js';
import { CardanoOfferService } from '../services/cardano/offers.js';

declare module 'fastify' {
  interface FastifyInstance {
    cardanoWalletService: CardanoWalletService | null;
    cardanoOfferService: CardanoOfferService | null;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  const url = fastify.config.cardanoUtxorpcUrl;
  const skeyFile = fastify.config.cardanoWalletSkeyFile;
  const chainState = fastify.cardanoChainStateService;
  if (!url || !skeyFile || !chainState) {
    fastify.decorate('cardanoWalletService', null);
    fastify.decorate('cardanoOfferService', null);
    fastify.log.debug(
      'Cardano offers not configured (CARDANO_UTXORPC_URL and CARDANO_WALLET_SKEY_FILE must both be set)',
    );
    return;
  }

  const wallet = await CardanoWalletService.create(
    url,
    skeyFile,
    () => chainState.protocolParams(),
    fastify.log,
  );
  fastify.decorate('cardanoWalletService', wallet);
  fastify.decorate('cardanoOfferService', new CardanoOfferService(wallet, fastify.log));
  fastify.log.info(
    { address: Buffer.from(wallet.address).toString('hex') },
    "CardanoOfferService init'd",
  );
});
