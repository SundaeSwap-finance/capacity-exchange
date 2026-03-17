import pino from 'pino';
import { buildApp } from './app.js';

function loggerTransport(): pino.TransportSingleOptions | undefined {
  if (process.env.NODE_ENV === 'dev') {
    return {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    };
  }
  if (process.env.LOG_FILE) {
    return {
      target: 'pino/file',
      options: { destination: process.env.LOG_FILE, mkdir: true },
    };
  }
  return undefined;
}

const start = async () => {
  const transport = loggerTransport();
  const app = await buildApp({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      ...(transport && { transport }),
    },
  });

  try {
    await app.ready();
    const port = app.config.PORT;
    await app.listen({ port, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
