import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { cryptoReady } from '@capacity-exchange/cardano-core';
import {
  CardanoHintService,
  readHintSigner,
  keyHashOf,
  toSchedules,
} from '../../services/cardano/hints.js';

declare module 'fastify' {
  interface FastifyInstance {
    cardanoHintService: CardanoHintService | null;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  const cardano = fastify.config.cardano;
  const schedules = toSchedules(fastify.config.priceFormulas.ADA ?? []);
  const wallet = fastify.cardanoWalletService;
  if (!cardano?.walletSkeyFile || !schedules.length || !wallet) {
    fastify.decorate('cardanoHintService', null);
    fastify.log.debug(
      'CardanoHintService not configured (needs the Cardano wallet, CARDANO_WALLET_SKEY_FILE and priceFormulas.ADA)',
    );
    return;
  }

  await cryptoReady();
  const signer = readHintSigner(cardano.walletSkeyFile);
  // Hints would otherwise be signed for one wallet while priced from another's balance.
  const keyHash = Buffer.from(keyHashOf(signer.vkey)).toString('hex');
  if (cardano.walletAddress.getProps().paymentPart?.hash !== keyHash) {
    throw new Error(
      `CARDANO_WALLET_SKEY_FILE is not the payment key of CARDANO_WALLET_ADDRESS (key hash ${keyHash})`,
    );
  }
  const service = new CardanoHintService(schedules, wallet, signer);
  fastify.decorate('cardanoHintService', service);
  fastify.log.info("CardanoHintService init'd");
});
