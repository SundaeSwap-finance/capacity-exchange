import pino from 'pino';

/** Create the server logger. Reads LOG_LEVEL, NODE_ENV, and LOG_FILE from process.env. */
export function createServerLogger(): pino.Logger {
  const level = process.env.LOG_LEVEL || 'info';
  let transport: pino.TransportSingleOptions | undefined;
  if (process.env.NODE_ENV === 'dev') {
    transport = {
      target: 'pino-pretty',
      options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' },
    };
  } else if (process.env.LOG_FILE) {
    transport = {
      target: 'pino/file',
      options: { destination: process.env.LOG_FILE, mkdir: true },
    };
  }
  return pino({ level, ...(transport && { transport }) });
}
