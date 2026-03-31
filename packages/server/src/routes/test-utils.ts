import { beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance, FastifyPluginAsync } from 'fastify';
import errorHandler from '../plugins/error-handler.js';

interface RouteTestAppOptions {
  decorations: Record<string, unknown>;
  routes: { plugin: FastifyPluginAsync; prefix: string };
}

/** Sets up a minimal Fastify app for route testing. Handles lifecycle via beforeAll/afterAll. */
export function useRouteTestApp(options: RouteTestAppOptions): { get: () => FastifyInstance } {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    for (const [key, value] of Object.entries(options.decorations)) {
      app.decorate(key, value);
    }
    app.register(errorHandler);
    app.register(options.routes.plugin, { prefix: options.routes.prefix });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  return {
    get: () => app,
  };
}
