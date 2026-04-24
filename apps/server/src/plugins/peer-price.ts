import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { PeerPriceService } from '../services/peerPrice.js';

declare module 'fastify' {
  interface FastifyInstance {
    peerPriceService: PeerPriceService;
  }
}

export default fp((fastify: FastifyInstance) => {
  const { peer } = fastify.config;
  const peerPriceService = new PeerPriceService(peer?.maxPrices ?? []);
  fastify.decorate('peerPriceService', peerPriceService);
});
