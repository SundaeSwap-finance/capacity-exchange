import type { AppContext, WalletStateSource } from '@sundaeswap/capacity-exchange-nodejs';
import {
  buildNetworkConfig,
  createAppContext,
  readWalletSyncTimeoutMs,
  resolveEnv,
} from '@sundaeswap/capacity-exchange-nodejs';
import { parseMnemonic, parseSeedHex } from '@sundaeswap/capacity-exchange-core';
import { wrapMidnightProviderForDustDiagnostics } from './dustDiagnostics.js';

export type WalletSeed = { type: 'seed'; seed: string } | { type: 'mnemonic'; mnemonic: string };

export interface FlowCtxConfig {
  seed: WalletSeed;
  stateSource: WalletStateSource;
}

export async function buildFlowCtx(networkId: string, config: FlowCtxConfig): Promise<AppContext> {
  const env = resolveEnv();
  const networkConfig = buildNetworkConfig(networkId, env);
  const ctx = await createAppContext({
    network: networkConfig,
    wallet: {
      seed: config.seed.type === 'mnemonic' ? parseMnemonic(config.seed.mnemonic) : parseSeedHex(config.seed.seed),
      stateSource: config.stateSource,
      walletSyncTimeoutMs: readWalletSyncTimeoutMs(env),
    },
  });
  return {
    ...ctx,
    midnightProvider: wrapMidnightProviderForDustDiagnostics(
      ctx.midnightProvider,
      networkConfig.endpoints.indexerHttpUrl
    ),
  };
}

export interface PollUntilOptions {
  label: string;
  timeoutMs: number;
  intervalMs: number;
}

export async function pollUntil(cond: () => Promise<boolean>, options: PollUntilOptions): Promise<void> {
  const { label, timeoutMs, intervalMs } = options;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await cond()) {
      return;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Timed out waiting for ${label}`);
}
