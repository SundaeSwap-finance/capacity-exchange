import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { AppContext, AppSetup } from './app-context.js';
import { getMidnightConfigById } from './config/env.js';
import { readSeed } from './config/seed.js';
import { createLogger } from './logger.js';

const logger = createLogger(import.meta);

export async function withAppContext<T>(networkId: string, fn: (ctx: AppContext) => T | Promise<T>): Promise<T> {
  logger.log(`Process ID: ${process.pid}`);
  logger.log(`Network ID: ${networkId}`);
  const config = getMidnightConfigById(networkId);
  setNetworkId(config.networkId);
  logger.log('Reading seed...');
  const seed = readSeed(config.walletSeedFile);
  logger.log('Starting app context...');
  const setup = new AppSetup(seed, config);
  const ctx = await setup.start();
  logger.log('App context ready');
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
