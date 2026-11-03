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
  const cardano = fastify.config.cardano;
  const schedules = toSchedules(fastify.config.priceFormulas.ADA ?? []);
  const wallet = fastify.cardanoWalletService;
  if (!cardano?.registrationSkeyFile || !schedules.length || !wallet) {
    fastify.decorate('cardanoHintService', null);
    fastify.log.debug(
      'CardanoHintService not configured (needs the Cardano wallet, CARDANO_REGISTRATION_SKEY_FILE and priceFormulas.ADA)',
    );
    return;
  }

  await cryptoReady();
  const signer = readHintSigner(cardano.registrationSkeyFile);
  const service = new CardanoHintService(schedules, wallet, signer);
  fastify.decorate('cardanoHintService', service);
  fastify.log.info("CardanoHintService init'd");
});
