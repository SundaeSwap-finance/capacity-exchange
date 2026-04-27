import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { PeerPriceService } from '../services/peerPrice.js';

declare module 'fastify' {
  interface FastifyInstance {
    peerPriceService: PeerPriceService | null;
  }
}

export default fp((fastify: FastifyInstance) => {
  const { peer } = fastify.config;
  if (!peer?.maxPrices?.length) {
    fastify.decorate('peerPriceService', null);
    fastify.log.debug('PeerPriceService disabled: no peer.maxPrices configured');
    return;
  }
  fastify.decorate('peerPriceService', new PeerPriceService(peer.maxPrices));
});
