import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { RootSchema } from '../models/root.js';
import { readFileSync } from 'fs';

const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'));

const rootRoutes: FastifyPluginAsyncTypebox = async (fastify, _opts) => {
  fastify.get('/', RootSchema, async (_request, _reply) => {
    return {
      name: packageJson.name,
      version: packageJson.version,
      env: {
        network: fastify.config.MIDNIGHT_NETWORK,
        node_url: fastify.config.NODE_URL,
        node_ws_url: fastify.config.NODE_WS_URL,
        indexer_url: fastify.config.INDEXER_URL,
        indexer_ws_url: fastify.config.INDEXER_WS_URL,
        proof_server_url: fastify.config.PROOF_SERVER_URL,
      },
    };
  });
};

export default rootRoutes;
