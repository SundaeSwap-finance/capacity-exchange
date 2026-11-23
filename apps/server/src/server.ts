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

  const onSignal = () => {
    shutdown().catch((err) => {
      console.error('Failed to shut down cleanly:', err);
      process.exit(1);
    });
  };
  process.on('SIGTERM', onSignal);
  process.on('SIGINT', onSignal);
};

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
