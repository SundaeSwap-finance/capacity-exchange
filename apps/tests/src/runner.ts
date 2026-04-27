import { runCli, withAppContext, createLogger, type AppContext } from '@sundaeswap/capacity-exchange-nodejs';
import { getTestConfig, type TestConfig } from './config.js';
import { runSponsorFlow } from './flows/sponsor-flow.js';
import { runExchangeFlow } from './flows/exchange-flow.js';

const logger = createLogger(import.meta);

interface FlowResult {
  flow: string;
  durationMs: number;
  result?: unknown;
  error?: string;
}

interface RunnerOutput {
  passed: number;
  failed: number;
  flows: FlowResult[];
}

async function runFlow(name: string, fn: () => Promise<unknown>): Promise<FlowResult> {
  const start = Date.now();
  try {
    const result = await fn();
    const durationMs = Date.now() - start;
    logger.info({ flow: name, durationMs }, 'PASS');
    return { flow: name, durationMs, result };
  } catch (err) {
    const durationMs = Date.now() - start;
    const error = err instanceof Error ? err.message : String(err);
    logger.error({ flow: name, durationMs }, `FAIL: ${error}`);
    return { flow: name, durationMs, error };
  }
}

async function runAllFlows(ctx: AppContext, config: TestConfig): Promise<FlowResult[]> {
  const flows: FlowResult[] = [];

  flows.push(await runFlow('sponsor', () => runSponsorFlow(ctx, config.tokenMintAddress, config.cesUrl)));

  // The sponsor flow mints derived tokens to this wallet. Wait for the shielded
  // wallet to sync those tokens before the exchange flow tries to spend them.
  logger.info('Waiting for shielded wallet to sync minted tokens...');
  await ctx.walletContext.walletFacade.shielded.waitForSyncedState();
  logger.info('Shielded wallet synced');

  flows.push(
    await runFlow('exchange', () =>
      runExchangeFlow(ctx, config.networkId, config.counterAddress, config.cesUrl, config.derivedTokenColor)
    )
  );

  return flows;
}

function summarize(flows: FlowResult[]): RunnerOutput {
  const passed = flows.filter((f) => !f.error).length;
  const failed = flows.filter((f) => f.error).length;
  return { passed, failed, flows };
}

function main(): Promise<RunnerOutput> {
  const config = getTestConfig();

  return withAppContext(config.networkId, async (ctx) => {
    const flows = await runAllFlows(ctx, config);
    const output = summarize(flows);

    logger.info({ passed: output.passed, failed: output.failed, total: flows.length }, 'All flows complete');

    if (output.failed > 0) {
      throw new Error(`${output.failed} flow(s) failed`);
    }

    return output;
  });
}

runCli(main, { pretty: true });
