import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import type { WalletProvider } from '@midnight-ntwrk/midnight-js-types';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { getLedgerParameters } from '@sundaeswap/capacity-exchange-core';
import type { ChainStateProvider } from '@sundaeswap/capacity-exchange-providers';
import { buildCesWalletProvider } from '../config/cesWalletProvider.js';

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

  const cesWalletProvider = buildCesWalletProvider(
    fastify.walletService,
    fastify.peerPriceService,
    fastify.config.networkId,
    chainStateProvider,
    fastify.config.capacityExchangeUrls,
    fastify.log,
  );

  fastify.decorate('cesWalletProvider', cesWalletProvider);
  fastify.log.trace("CES wallet provider init'd");
});
