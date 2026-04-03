import { initTelemetry } from './telemetry.js';
import { loadConfig } from './loadConfig.js';
import { buildApp } from './app.js';

const start = async () => {
  const { config, logger } = await loadConfig();
  const telemetry = initTelemetry(config, logger);
  const app = await buildApp(config, { loggerInstance: logger });
  await app.ready();
  await app.listen({ port: config.port, host: '0.0.0.0' });

  const shutdown = async () => {
    await app.close();
    await telemetry?.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
};

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
