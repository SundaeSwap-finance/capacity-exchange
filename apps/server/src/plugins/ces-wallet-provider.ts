import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import type { WalletProvider } from '@midnight-ntwrk/midnight-js-types';
import { indexerChainStateProvider } from '@sundaeswap/capacity-exchange-providers';
import { buildCesWalletProvider } from '../config/cesWalletProvider.js';
import { createAutoSelectCurrency, fixedCurrencySelector } from '../config/peerCurrencySelector.js';
import { computeCurrencyId } from '../services/formulaIndex.js';

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

  const peer = fastify.config.peer!;
  const { walletService, peerPriceService, log } = fastify;

  const singleCurrency = peer.maxPrices.length === 1 ? peer.maxPrices[0].currency : undefined;
  // use `fixedCurrencySelector` if `peer.maxPrices` has exactly ONE entry
  const promptForCurrency = singleCurrency
    ? fixedCurrencySelector(log, walletService, peerPriceService, {
        ...singleCurrency,
        id: computeCurrencyId(singleCurrency),
      })
    : createAutoSelectCurrency(log, walletService, peerPriceService);

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
