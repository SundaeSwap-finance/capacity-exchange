import { loadConfig } from './loadConfig.js';
import { buildApp } from './app.js';

const start = async () => {
  const { config, logger } = await loadConfig();
  const app = await buildApp(config, { loggerInstance: logger });
  await app.ready();
  await app.listen({ port: config.port, host: '0.0.0.0' });
};

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
