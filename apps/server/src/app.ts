import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import Fastify, { FastifyInstance, FastifyPluginAsync, FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import chainStatePlugin from './plugins/midnight/chain-state.js';
import cardanoChainStatePlugin from './plugins/cardano-chain-state.js';
import walletPlugin from './plugins/midnight/wallet-utxo.js';
import cesWalletProviderPlugin from './plugins/ces-wallet-provider.js';
import cardanoPlugin from './plugins/cardano.js';
import offerPlugin from './plugins/midnight/offer.js';
import sponsorPlugin from './plugins/midnight/sponsor.js';
import pricesPlugin from './plugins/price.js';
import peerPricesPlugin from './plugins/peer-price.js';
import quotePlugin from './plugins/quote.js';
import txPlugin from './plugins/midnight/tx.js';
import metricsPlugin from './plugins/metrics.js';
import errorHandler from './plugins/error-handler.js';
import observability from './plugins/observability.js';
import healthRoutes from './routes/health.js';
import rootRoutes from './routes/root.js';
import offerRoutes from './routes/midnight/offers.js';
import adaOfferRoutes from './routes/midnight/adaOffers.js';
import sponsorRoutes from './routes/midnight/sponsor.js';
import priceRoutes, { assetPriceRoutes } from './routes/prices.js';
import metricsRoutes from './routes/metrics.js';
import type { AppConfig } from './loadConfig.js';
import { packageName, packageVersion } from './packageInfo.js';

declare module 'fastify' {
  interface FastifyInstance {
    config: AppConfig;
  }
}

export async function buildApp(
  config: AppConfig,
  opts: FastifyServerOptions = {},
): Promise<FastifyInstance> {
  const app = Fastify(opts).withTypeProvider<TypeBoxTypeProvider>();
  app.decorate('config', config);
  app.register(cors, { origin: '*' });
  await app.register(errorHandler);
  await app.register(observability);
  await app.register(chainStatePlugin);
  await app.register(cardanoChainStatePlugin);
  await app.register(walletPlugin);
  await app.register(pricesPlugin);
  await app.register(peerPricesPlugin);
  await app.register(cesWalletProviderPlugin);
  await app.register(txPlugin);
  await app.register(quotePlugin);
  await app.register(metricsPlugin);
  await app.register(cardanoPlugin);
  await app.register(offerPlugin);
  await app.register(sponsorPlugin);
  await registerRoutes(app);
  return app;
}

// TODO: remove once clients have moved to /api/midnight. Serves the Midnight routes at their
// old /api paths too, hidden from the OpenAPI spec.
const legacyMidnightRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRoute', (route) => {
    route.schema = { ...route.schema, hide: true };
  });
  await app.register(offerRoutes);
  await app.register(adaOfferRoutes);
  await app.register(sponsorRoutes);
};

export async function registerRoutes(app: FastifyInstance) {
  await app.register(swagger, {
    openapi: {
      info: {
        title: packageName,
        version: packageVersion,
      },
    },
  });
  await app.register(swaggerUi, {
    routePrefix: '/docs',
  });
  app.register(rootRoutes);
  app.register(healthRoutes, { prefix: '/health' });
  app.register(priceRoutes, { prefix: '/api' });
  app.register(assetPriceRoutes('DUST'), { prefix: '/api/midnight' });
  app.register(assetPriceRoutes('ADA'), { prefix: '/api/cardano' });
  app.register(offerRoutes, { prefix: '/api/midnight' });
  app.register(adaOfferRoutes, { prefix: '/api/midnight' });
  app.register(sponsorRoutes, { prefix: '/api/midnight' });
  app.register(legacyMidnightRoutes, { prefix: '/api' });
  app.register(metricsRoutes, { prefix: '/api' });
}
