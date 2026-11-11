import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import type { WalletProvider } from '@midnight-ntwrk/midnight-js/types';
import { indexerChainStateProvider } from '@sundaeswap/capacity-exchange-providers';
import { buildCesWalletProvider } from '../config/cesWalletProvider.js';
import { createAutoSelectCurrency } from '../config/peerCurrencySelector.js';
import { peerChainStateProvider } from '../config/peerChainStateProvider.js';

declare module 'fastify' {
  interface FastifyInstance {
    cesWalletProvider: WalletProvider | null;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  if (!fastify.midnightWalletService || !fastify.config.midnight) {
    fastify.decorate('cesWalletProvider', null);
    fastify.log.debug('CES wallet provider not configured (no Midnight network configured)');
    return;
  }

  if (!fastify.peerPriceService) {
    fastify.decorate('cesWalletProvider', null);
    fastify.log.trace('Peer fallback disabled: PeerPriceService not available');
    return;
  }

  if (!fastify.midnightChainStateService) {
    throw new Error("CES wallet provider requires MidnightChainStateService to be init'd first");
  }

  const { indexerHttpUrl, indexerWsUrl } = fastify.config.midnight.endpoints;
  const chainStateProvider = peerChainStateProvider(
    indexerChainStateProvider(indexerHttpUrl, indexerWsUrl),
    fastify.midnightChainStateService,
  );
  fastify.addHook('onClose', async () => {
    await chainStateProvider.dispose();
  });

  const { midnightWalletService, peerPriceService, log } = fastify;

  const promptForCurrency = createAutoSelectCurrency(log, midnightWalletService, peerPriceService);

  const cesWalletProvider = buildCesWalletProvider(
    midnightWalletService,
    fastify.config.midnight.networkId,
    chainStateProvider,
    fastify.config.capacityExchangeUrls,
    log,
    promptForCurrency,
  );

  fastify.decorate('cesWalletProvider', cesWalletProvider);
  fastify.log.trace("CES wallet provider init'd");
});
