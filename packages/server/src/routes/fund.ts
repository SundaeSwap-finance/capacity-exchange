import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Transaction, SignatureEnabled, Proof, PreBinding } from '@midnight-ntwrk/ledger-v7';
import { FundRequest, FundReply, FundSchema } from '../models/fund.js';

const fundRoutes: FastifyPluginAsyncTypebox = async (fastify, _opts) => {
  fastify.post<{
    Body: typeof FundRequest.static;
    Reply: typeof FundReply.static;
  }>('/fund', FundSchema, async (request, reply) => {
    const userTx = Transaction.deserialize<SignatureEnabled, Proof, PreBinding>(
      'signature',
      'proof',
      'pre-binding',
      Buffer.from(request.body.provenTx, 'hex'),
    );

    const result = await fastify.fundService.fundTx(userTx);

    switch (result.status) {
      case 'ok':
        return reply.code(200).send({
          tx: Buffer.from(result.tx.serialize()).toString('hex'),
        });
      case 'ineligible':
        return reply.status(422).send({
          error: 'Unprocessable Entity',
          message: 'Transaction is not eligible for funding',
        });
      case 'insufficient-funds':
        return reply.serviceUnavailable('Insufficient dust available. Please try again later.');
      case 'wallet-syncing':
        return reply.serviceUnavailable(
          'Wallet is currently syncing with the network. Please try again shortly.',
        );
      case 'wallet-sync-failed':
        return reply.internalServerError(
          'Wallet sync failed. The service is unable to process requests.',
          result.error,
        );
      case 'illegal-state':
        return reply.internalServerError('Service is in an illegal state.', result.error);
    }
  });
};

export default fundRoutes;
