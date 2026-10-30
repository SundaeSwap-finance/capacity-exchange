import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { cryptoReady } from '@capacity-exchange/cardano-core';
import { CardanoHintService, readHintSigner, toSchedules } from '../../services/cardano/hints.js';

declare module 'fastify' {
  interface FastifyInstance {
    cardanoHintService: CardanoHintService | null;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  const skeyFile = fastify.config.cardano?.hintsSkeyFile;
  const prices = fastify.config.cardanoPrices;
  const wallet = fastify.cardanoWalletService;
  if (!skeyFile || !prices.length || !wallet) {
    fastify.decorate('cardanoHintService', null);
    fastify.log.debug(
      'CardanoHintService not configured (needs the Cardano wallet, CARDANO_HINTS_SKEY_FILE and cardano.prices)',
    );
    return;
  }

  await cryptoReady();
  const service = new CardanoHintService(
    toSchedules(prices),
    // checkCardanoPrices only admits pairs that spend ADA.
    () => wallet.lovelace(),
    readHintSigner(skeyFile),
  );
  fastify.decorate('cardanoHintService', service);
  fastify.log.info("CardanoHintService init'd");
});
