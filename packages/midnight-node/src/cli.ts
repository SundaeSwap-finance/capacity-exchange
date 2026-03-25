import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { AppContext, createAppContext } from './appContext.js';
import { type AppConfig, getAppConfigById } from './appConfig.js';
import { createLogger } from './createLogger.js';

const logger = createLogger(import.meta);

export function requireNetworkId(): string {
  const networkId = process.env.NETWORK_ID;
  if (!networkId) {
    throw new Error('NETWORK_ID environment variable is required (e.g., NETWORK_ID=preview)');
  }
  return networkId;
}

export async function withAppContext<T>(configOrNetworkId: AppConfig | string, fn: (ctx: AppContext) => T | Promise<T>): Promise<T> {
  logger.info(`Process ID: ${process.pid}`);
  const config = typeof configOrNetworkId === 'string'
    ? getAppConfigById(configOrNetworkId)
    : configOrNetworkId;
  const { seed: _, ...loggableConfig } = config;
  logger.info('Config:', loggableConfig);
  setNetworkId(config.networkId);
  logger.info('Starting app context...');
  const ctx = await createAppContext(config);
  logger.info('App context ready');
  return fn(ctx);
}

export interface RunCliOptions {
  pretty?: boolean;
}

export function runCli<T>(main: () => Promise<T>, options: RunCliOptions = {}): void {
  const { pretty = false } = options;

  main().then(
    (result) => {
      const output = pretty ? JSON.stringify(result, null, 2) : JSON.stringify(result);
      console.log(output);
      process.exit(0);
    },
    (err) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error(JSON.stringify({ error: message }));
      process.exit(1);
    }
  );
}
