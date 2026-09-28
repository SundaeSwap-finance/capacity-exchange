import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import type { WalletProvider } from '@midnight-ntwrk/midnight-js/types';
import { indexerChainStateProvider } from '@sundaeswap/capacity-exchange-providers';
import { buildCesWalletProvider } from '../config/cesWalletProvider.js';
import { createAutoSelectCurrency } from '../config/peerCurrencySelector.js';

declare module 'fastify' {
  interface FastifyInstance {
    cesWalletProvider: WalletProvider | null;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  if (!fastify.walletService || !fastify.config.midnight) {
    fastify.decorate('cesWalletProvider', null);
    fastify.log.debug('CES wallet provider not configured (no Midnight network configured)');
    return;
  }

  if (!fastify.peerPriceService) {
    fastify.decorate('cesWalletProvider', null);
    fastify.log.trace('Peer fallback disabled: PeerPriceService not available');
    return;
  }

  const { indexerHttpUrl, indexerWsUrl } = fastify.config.midnight.endpoints;
  const chainStateProvider = indexerChainStateProvider(indexerHttpUrl, indexerWsUrl);

  const { walletService, peerPriceService, log } = fastify;

  const promptForCurrency = createAutoSelectCurrency(log, walletService, peerPriceService);

  const cesWalletProvider = buildCesWalletProvider(
    walletService,
    fastify.config.midnight.networkId,
    chainStateProvider,
    fastify.config.capacityExchangeUrls,
    log,
    promptForCurrency,
  );

  fastify.decorate('cesWalletProvider', cesWalletProvider);
  fastify.log.trace("CES wallet provider init'd");
});
