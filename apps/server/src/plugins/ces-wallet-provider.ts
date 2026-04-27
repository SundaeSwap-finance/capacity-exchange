import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import type { WalletProvider } from '@midnight-ntwrk/midnight-js-types';
import { indexerChainStateProvider } from '@sundaeswap/capacity-exchange-providers';
import { buildCesWalletProvider } from '../config/cesWalletProvider.js';
import { createAutoSelectCurrency } from '../config/peerCurrencySelector.js';

declare module 'fastify' {
  interface FastifyInstance {
    cesWalletProvider: WalletProvider | null;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  if (!fastify.walletService) {
    throw new Error("CesWalletProviderPlugin requires WalletService to be init'd first");
  }

  if (!fastify.peerPriceService) {
    fastify.decorate('cesWalletProvider', null);
    fastify.log.trace('Peer fallback disabled: PeerPriceService not available');
    return;
  }

  const { indexerHttpUrl, indexerWsUrl } = fastify.config.endpoints;
  const chainStateProvider = indexerChainStateProvider(indexerHttpUrl, indexerWsUrl);

  const { walletService, peerPriceService, log } = fastify;

  const promptForCurrency = createAutoSelectCurrency(log, walletService, peerPriceService);

  const cesWalletProvider = buildCesWalletProvider(
    walletService,
    fastify.config.networkId,
    chainStateProvider,
    fastify.config.capacityExchangeUrls,
    log,
    promptForCurrency,
  );

  fastify.decorate('cesWalletProvider', cesWalletProvider);
  fastify.log.trace("CES wallet provider init'd");
});
