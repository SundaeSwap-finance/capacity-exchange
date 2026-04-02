import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { RootSchema } from '../models/root.js';
import { packageName, packageVersion } from '../packageInfo.js';

const rootRoutes: FastifyPluginAsyncTypebox = async (fastify, _opts) => {
  fastify.get('/', RootSchema, async (_request, _reply) => {
    return {
      name: packageName,
      version: packageVersion,
      env: {
        network: fastify.config.networkId,
        node_url: fastify.config.endpoints.nodeUrl,
        node_ws_url: fastify.config.endpoints.nodeUrl,
        indexer_url: fastify.config.endpoints.indexerHttpUrl,
        indexer_ws_url: fastify.config.endpoints.indexerWsUrl,
        proof_server_url: fastify.config.endpoints.proofServerUrl,
      },
    };
  });
};

export default rootRoutes;
