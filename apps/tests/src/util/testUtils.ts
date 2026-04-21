import type { AppContext } from '@sundaeswap/capacity-exchange-nodejs';
import { getAppConfigById, createAppContext } from '@sundaeswap/capacity-exchange-nodejs';
import { parseMnemonic } from '@sundaeswap/capacity-exchange-core';

export interface FlowCtxConfig {
  mnemonic: string;
  walletStateDir: string;
}

export async function buildFlowCtx(networkId: string, config: FlowCtxConfig): Promise<AppContext> {
  const seed = parseMnemonic(config.mnemonic);
  const baseConfig = getAppConfigById(networkId);
  return createAppContext({ ...baseConfig, seed, walletStateDir: config.walletStateDir });
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
