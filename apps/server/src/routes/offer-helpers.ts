import { FastifyReply } from 'fastify';
import { CreateOfferResult } from '../services/offer.js';

export function replyWithOfferResult(reply: FastifyReply, result: CreateOfferResult): FastifyReply {
  switch (result.status) {
    case 'ok':
      return reply.code(201).send(result.offer);
    case 'insufficient-funds':
      return reply.conflict(`Insufficient specks available for request of ${result.requested}`);
    case 'wallet-syncing':
      return reply.serviceUnavailable(
        "Wallet is currently sync'ing with the network. Please try again shortly.",
      );
    case 'wallet-sync-failed':
      return reply.internalServerError(
        'Wallet sync failed. The service is unable to process requests.',
        result.error,
      );
    case 'unsupported-currency':
      return reply.badRequest(`Unsupported currency: ${result.currency}`);
    case 'illegal-state':
      return reply.internalServerError('Service is in an illegal state.', result.error);
  }
}
