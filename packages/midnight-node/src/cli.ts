import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { AppContext, createAppContext } from './appContext';
import { getAppConfigById } from './appConfig';
import { createLogger } from './createLogger';

const logger = createLogger(import.meta);

export async function withAppContext<T>(networkId: string, fn: (ctx: AppContext) => T | Promise<T>): Promise<T> {
  logger.info(`Process ID: ${process.pid}`);
  const config = getAppConfigById(networkId);
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
