import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { RootSchema } from '../models/root.js';
import { packageName, packageVersion } from '../packageInfo.js';

const rootRoutes: FastifyPluginAsyncTypebox = async (fastify, _opts) => {
  fastify.get('/', RootSchema, async (_request, _reply) => {
    const { midnight } = fastify.config;
    return {
      name: packageName,
      version: packageVersion,
      capacityAssets: fastify.priceService.listAssets(),
      chains: {
        midnight: midnight && {
          network: midnight.networkId,
          nodeUrl: midnight.endpoints.nodeUrl,
          indexerUrl: midnight.endpoints.indexerHttpUrl,
          indexerWsUrl: midnight.endpoints.indexerWsUrl,
          proofServerUrl: midnight.endpoints.proofServerUrl,
        },
      },
    };
  });
};

export default rootRoutes;
