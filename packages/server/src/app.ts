import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import Fastify, { FastifyInstance, FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import walletPlugin from './plugins/wallet-utxo.js';
import offerPlugin from './plugins/offer.js';
import sponsorPlugin from './plugins/sponsor.js';
import pricesPlugin from './plugins/price.js';
import txPlugin from './plugins/tx.js';
import metricsPlugin from './plugins/metrics.js';
import errorHandler from './plugins/error-handler.js';
import healthRoutes from './routes/health.js';
import rootRoutes from './routes/root.js';
import offerRoutes from './routes/offers.js';
import sponsorRoutes from './routes/sponsor.js';
import priceRoutes from './routes/prices.js';
import metricsRoutes from './routes/metrics.js';
import type { AppConfig } from './loadConfig.js';
import { readFileSync } from 'fs';

const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'));

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
  await app.register(swagger, {
    openapi: {
      info: {
        title: packageJson.name,
        version: packageJson.version,
      },
    },
  });
  await app.register(swaggerUi, {
    routePrefix: '/docs',
  });
  await app.register(errorHandler);
  await app.register(walletPlugin);
  await app.register(txPlugin);
  await app.register(pricesPlugin);
  await app.register(metricsPlugin);
  await app.register(offerPlugin);
  await app.register(sponsorPlugin);
  app.register(rootRoutes);
  app.register(healthRoutes, { prefix: '/health' });
  app.register(priceRoutes, { prefix: '/api' });
  app.register(offerRoutes, { prefix: '/api' });
  app.register(sponsorRoutes, { prefix: '/api' });
  app.register(metricsRoutes, { prefix: '/api' });
  return app;
}
