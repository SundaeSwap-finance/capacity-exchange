import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { RootSchema } from '../models/root.js';
import { packageName, packageVersion } from '../packageInfo.js';

const rootRoutes: FastifyPluginAsyncTypebox = async (fastify, _opts) => {
  fastify.get('/', RootSchema, async (_request, _reply) => {
    const { midnight } = fastify.config;
    const formulaAssets = fastify.priceService.listAssets();
    // Hints sell ADA whether or not `priceFormulas` prices it.
    const capacityAssets =
      fastify.cardanoHintService && !formulaAssets.includes('ADA')
        ? [...formulaAssets, 'ADA' as const]
        : formulaAssets;
    return {
      name: packageName,
      version: packageVersion,
      capacityAssets,
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
