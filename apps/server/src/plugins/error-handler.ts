import { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyError } from 'fastify';
import fp from 'fastify-plugin';

// Extend the global fastify context obj with error response helpers
declare module 'fastify' {
  interface FastifyReply {
    badRequest: (message?: string, details?: string) => FastifyReply;
    gone: (message?: string, details?: string) => FastifyReply;
    conflict: (message?: string, details?: string) => FastifyReply;
    serviceUnavailable: (message?: string, details?: string) => FastifyReply;
    internalServerError: (message?: string, details?: string) => FastifyReply;
  }
}

const errorHandler: FastifyPluginAsync = async (fastify: FastifyInstance, _opts) => {
  fastify.setErrorHandler((error: FastifyError | Error, _request, reply) => {
    if ('statusCode' in error && error.statusCode && error.statusCode < 500) {
      return reply.send(error);
    }
    // Global error handler to catch "unknown" errors
    fastify.log.error(error, 'Unhandled error');
    reply.status(500).send({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
    });
  });

  // Add helpers to the reply obj
  fastify.decorateReply(
    'badRequest',
    function (this: FastifyReply, message?: string, details?: string) {
      return this.status(400).send({
        error: 'Bad Request',
        message,
        details,
      });
    },
  );

  fastify.decorateReply('gone', function (this: FastifyReply, message?: string, details?: string) {
    return this.status(410).send({
      error: 'Gone',
      message,
      details,
    });
  });

  fastify.decorateReply(
    'conflict',
    function (this: FastifyReply, message?: string, details?: string) {
      return this.status(409).send({
        error: 'Conflict',
        message,
        details,
      });
    },
  );

  fastify.decorateReply(
    'internalServerError',
    function (this: FastifyReply, message?: string, details?: string) {
      return this.status(500).send({
        error: 'Internal Server Error',
        message,
        details,
      });
    },
  );

  fastify.decorateReply(
    'serviceUnavailable',
    function (this: FastifyReply, message?: string, details?: string) {
      return this.status(503).send({
        error: 'Service Unavailable',
        message,
        details,
      });
    },
  );
};

export default fp(errorHandler);
