import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import type { WalletProvider } from '@midnight-ntwrk/midnight-js-types';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { getLedgerParameters } from '@sundaeswap/capacity-exchange-core';
import type { ChainStateProvider } from '@sundaeswap/capacity-exchange-providers';
import { buildCesWalletProvider, type CurrencySelection } from '../config/cesWalletProvider.js';

declare module 'fastify' {
  interface FastifyInstance {
    cesWalletProvider: WalletProvider;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  if (!fastify.walletService) {
    throw new Error("CesWalletProviderPlugin requires WalletService to be init'd first");
  }
  if (!fastify.peerPriceService) {
    throw new Error("CesWalletProviderPlugin requires PeerPriceService to be init'd first");
  }

  const { indexerHttpUrl, indexerWsUrl } = fastify.config.endpoints;
  const publicDataProvider = indexerPublicDataProvider(indexerHttpUrl, indexerWsUrl);
  const chainStateProvider: ChainStateProvider = {
    queryContractState: (addr, cfg) => publicDataProvider.queryContractState(addr, cfg),
    getLedgerParameters: () => getLedgerParameters(indexerHttpUrl),
  };

  const peer = fastify.config.peer;
  // If `peer.maxPrices` has exactly ONE entry, the currency to pay with is obvious —
  // use `fixed` mode to pre-filter prices and skip the auto-selection logic.
  const rawCurrency = peer?.maxPrices.length === 1 ? peer.maxPrices[0].currency : undefined;
  const currencySelection: CurrencySelection = rawCurrency
    ? {
        mode: 'fixed',
        currency: { ...rawCurrency, id: `${rawCurrency.type}:${rawCurrency.rawId}` },
      }
    : // With multiple entries, fall back to `auto` so the selector picks the cheapest eligible offer.
      { mode: 'auto' };

  const cesWalletProvider = buildCesWalletProvider(
    fastify.walletService,
    fastify.peerPriceService,
    fastify.config.networkId,
    chainStateProvider,
    fastify.config.capacityExchangeUrls,
    fastify.log,
    currencySelection,
  );

  fastify.decorate('cesWalletProvider', cesWalletProvider);
  fastify.log.trace("CES wallet provider init'd");
});
