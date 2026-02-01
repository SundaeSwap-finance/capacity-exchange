import 'dotenv/config';
import { AppContext, AppSetup } from './app-context.js';
import { getMidnightConfig } from './config/env.js';
import { readSeed } from './config/seed.js';

export async function withAppContext<T>(privateDataDir: string, fn: (ctx: AppContext) => T | Promise<T>): Promise<T> {
  console.error(`[CLI] Process ID: ${process.pid}`);
  console.error('[CLI] Reading seed...');
  const seed = readSeed();
  const config = getMidnightConfig(privateDataDir);
  console.error('[CLI] Starting app context...');
  console.error(`[CLI] Private data dir: ${privateDataDir}`);
  const setup = new AppSetup(seed, config);
  const ctx = await setup.start();
  console.error('[CLI] App context ready');
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
