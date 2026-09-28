import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { RootSchema } from '../models/root.js';
import { packageName, packageVersion } from '../packageInfo.js';

const rootRoutes: FastifyPluginAsyncTypebox = async (fastify, _opts) => {
  fastify.get('/', RootSchema, async (_request, _reply) => {
    return {
      name: packageName,
      version: packageVersion,
      env: {
        network: fastify.config.midnight?.networkId ?? null,
        node_url: fastify.config.midnight?.endpoints.nodeUrl ?? null,
        node_ws_url: fastify.config.midnight?.endpoints.nodeUrl ?? null,
        indexer_url: fastify.config.midnight?.endpoints.indexerHttpUrl ?? null,
        indexer_ws_url: fastify.config.midnight?.endpoints.indexerWsUrl ?? null,
        proof_server_url: fastify.config.midnight?.endpoints.proofServerUrl ?? null,
      },
    };
  });
};

export default rootRoutes;
