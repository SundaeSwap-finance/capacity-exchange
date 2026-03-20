import { loadConfig } from './loadConfig.js';
import { buildApp } from './app.js';

const start = async () => {
  const { config, logger } = await loadConfig();

  const app = await buildApp(config, { loggerInstance: logger });

  try {
    await app.ready();
    await app.listen({ port: config.port, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
