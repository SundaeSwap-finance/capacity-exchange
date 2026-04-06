import fp from 'fastify-plugin';
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { meterService } from '../meter.js';

/** Automatic HTTP metrics via onResponse hook. */
const observability: FastifyPluginAsync = async (fastify: FastifyInstance, _opts) => {
  const meter = meterService.getMeter();
  const httpResponses = meter.createCounter('ces.http.responses', {
    description: 'HTTP responses by status and route',
  });
  const httpRequestDuration = meter.createHistogram('ces.http.request_duration_ms', {
    description: 'HTTP request duration in milliseconds',
    unit: 'ms',
  });

  fastify.addHook('onResponse', (request, reply, done) => {
    const route = request.routeOptions?.url ?? 'unknown';
    const attrs = { status: reply.statusCode.toString(), route };
    httpResponses.add(1, attrs);
    httpRequestDuration.record(reply.elapsedTime, attrs);
    done();
  });
};

export default fp(observability);
