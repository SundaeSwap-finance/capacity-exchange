import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { AppContext, createAppContext } from './appContext.js';
import { AppConfig, buildAppConfig, resolveEnv } from './appConfig.js';
import { createLogger } from './createLogger.js';

const logger = createLogger(import.meta);

/**
 * Runs `fn` with an init'd `AppContext` from a provided `AppConfig`. Use this
 * when you've resolved your own `Env`.
 */
export async function withAppContext<T>(config: AppConfig, fn: (ctx: AppContext) => T | Promise<T>): Promise<T> {
  logger.info(`Process ID: ${process.pid}`);
  const { seed: _, ...loggableWallet } = config.wallet;
  logger.info('Config:', { network: config.network, wallet: loggableWallet });
  setNetworkId(config.network.networkId);
  logger.info('Starting app context...');
  const ctx = await createAppContext(config);
  logger.info('App context ready');
  try {
    return await fn(ctx);
  } finally {
    try {
      await ctx.walletContext.walletFacade.stop();
    } catch (err) {
      logger.warn({ err: err instanceof Error ? err : String(err) }, 'Wallet facade stop failed');
    }
  }
}

/**
 * Convenience wrapper around {@link withAppContext} for tools that take
 * `networkId` from argv or env and have no other env reads. Resolves `Env`
 * (merges .env file + `process.env`) and builds an `AppConfig` internally.
 */
export async function withAppContextFromEnv<T>(networkId: string, fn: (ctx: AppContext) => T | Promise<T>): Promise<T> {
  const config = buildAppConfig(networkId, resolveEnv());
  return withAppContext(config, fn);
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
