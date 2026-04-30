import {
  runCli,
  withAppContext,
  buildNetworkConfig,
  readWalletSyncTimeoutMs,
  resolveEnv,
  createLogger,
  exportChainSnapshot,
  type AppConfig,
  type AppContext,
  type WalletConfig,
} from '@sundaeswap/capacity-exchange-nodejs';
import { generateMnemonic, parseMnemonic } from '@sundaeswap/capacity-exchange-core';
import { getTestConfig, type TestConfig } from './config.js';
import { runSponsorFlow } from './flows/sponsor-flow.js';
import { runRegistryFlow } from './flows/registry-flow.js';
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

async function runAllFlows(config: TestConfig): Promise<FlowResult[]> {
  const flows: FlowResult[] = [];

  flows.push(
    await runFlow('sponsor', () =>
      runSponsorFlow(config.networkId, config.sponsorFlowConfig, config.tokenMintAddress, config.cesUrl)
    )
  );

  flows.push(await runFlow('registry', () => runRegistryFlow(config.networkId, config.registryFlowConfig)));

  flows.push(
    await runFlow('exchange', () =>
      runExchangeFlow(
        config.networkId,
        config.exchangeFlowConfig,
        config.counterAddress,
        config.cesUrl,
        config.derivedTokenColor
      )
    )
  );

  return flows;
}

function summarize(flows: FlowResult[]): RunnerOutput {
  const passed = flows.filter((f) => !f.error).length;
  const failed = flows.filter((f) => f.error).length;
  return { passed, failed, flows };
}

function buildRunnerAppConfig(config: TestConfig): AppConfig {
  const env = resolveEnv();
  logger.info('Generating in-memory runner wallet');
  const walletConfig: WalletConfig = {
    seed: parseMnemonic(generateMnemonic()),
    stateSource: { kind: 'inMemory', chainSnapshot: config.chainSnapshot },
    walletSyncTimeoutMs: readWalletSyncTimeoutMs(env),
  };
  return {
    network: buildNetworkConfig(config.networkId, env),
    wallet: walletConfig,
  };
}

async function runAndExport(ctx: AppContext, config: TestConfig): Promise<RunnerOutput> {
  const flows = await runAllFlows(config);
  const output = summarize(flows);

  logger.info({ passed: output.passed, failed: output.failed, total: flows.length }, 'All flows complete');

  if (output.failed > 0) {
    throw new Error(`${output.failed} flow(s) failed`);
  }
  try {
    const snapshot = await exportChainSnapshot(
      ctx.walletContext.walletFacade,
      config.networkId,
      config.chainSnapshotDir
    );
    logger.info(`Exported chain snapshot to ${config.chainSnapshotDir} at offset ${snapshot.shielded.offset}`);
  } catch (err) {
    logger.warn(
      { err: err instanceof Error ? err : String(err), chainSnapshotDir: config.chainSnapshotDir },
      'Failed to export chain snapshot; continuing'
    );
  }
  return output;
}

function main(): Promise<RunnerOutput> {
  const env = resolveEnv();
  const config = getTestConfig(env);
  if (!config.chainSnapshot) {
    logger.info(`No cached chain snapshot in ${config.chainSnapshotDir} — wallet will sync from genesis`);
  }
  const appConfig = buildRunnerAppConfig(config);
  return withAppContext(appConfig, (ctx) => runAndExport(ctx, config));
}

runCli(main, { pretty: true });
