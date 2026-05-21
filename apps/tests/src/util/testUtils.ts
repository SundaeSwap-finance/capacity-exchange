import type { AppContext, WalletStateSource } from '@sundaeswap/capacity-exchange-nodejs';
import {
  buildNetworkConfig,
  createAppContext,
  readWalletSyncTimeoutMs,
  resolveEnv,
} from '@sundaeswap/capacity-exchange-nodejs';
import { parseMnemonic, parseSeedHex } from '@sundaeswap/capacity-exchange-core';

export type WalletSeed = { type: 'seed'; seed: string } | { type: 'mnemonic'; mnemonic: string };

/**
 *Looks for `${prefix}_SEED` and `${prefix}_MNEMONIC` from the environment.
 * Throws if neither is set or both are set.
 */
export function requireEnvSeed(env: Record<string, string | undefined>, prefix: string): WalletSeed {
  const seedVar = `${prefix}_SEED`;
  const mnemonicVar = `${prefix}_MNEMONIC`;
  const seed = env[seedVar];
  const mnemonic = env[mnemonicVar];
  if (seed && mnemonic) {
    throw new Error(`Set exactly one of ${seedVar} or ${mnemonicVar}, not both`);
  }
  if (seed) {
    return { type: 'seed', seed };
  }
  if (mnemonic) {
    return { type: 'mnemonic', mnemonic };
  }
  throw new Error(`Missing environment variables: ${seedVar} or ${mnemonicVar}`);
}

export interface FlowCtxConfig {
  seed: WalletSeed;
  stateSource: WalletStateSource;
}

export async function buildFlowCtx(networkId: string, config: FlowCtxConfig): Promise<AppContext> {
  const env = resolveEnv();
  return createAppContext({
    network: buildNetworkConfig(networkId, env),
    wallet: {
      seed: config.seed.type === 'mnemonic' ? parseMnemonic(config.seed.mnemonic) : parseSeedHex(config.seed.seed),
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
