import type { AppContext, WalletStateSource } from '@sundaeswap/capacity-exchange-nodejs';
import {
  buildNetworkConfig,
  createAppContext,
  readWalletSyncTimeoutMs,
  resolveEnv,
} from '@sundaeswap/capacity-exchange-nodejs';
import { parseMnemonic } from '@sundaeswap/capacity-exchange-core';

export interface FlowCtxConfig {
  mnemonic: string;
  stateSource: WalletStateSource;
}

export async function buildFlowCtx(networkId: string, config: FlowCtxConfig): Promise<AppContext> {
  const env = resolveEnv();
  return createAppContext({
    network: buildNetworkConfig(networkId, env),
    wallet: {
      seed: parseMnemonic(config.mnemonic),
      stateSource: config.stateSource,
      walletSyncTimeoutMs: readWalletSyncTimeoutMs(env),
    },
  });
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
