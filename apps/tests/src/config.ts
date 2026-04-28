import { loadChainSnapshot, requireEnvVar, type Env } from '@sundaeswap/capacity-exchange-nodejs';
import type { ChainSnapshot } from '@sundaeswap/capacity-exchange-core';
import type { FlowCtxConfig, WalletSeed } from './util/testUtils.js';

export interface TestConfig {
  networkId: string;
  cesUrl: string;
  counterAddress: string;
  tokenMintAddress: string;
  derivedTokenColor: string;
  chainSnapshotDir: string;
  chainSnapshot: ChainSnapshot | undefined;
  sponsorFlowConfig: FlowCtxConfig;
  exchangeFlowConfig: FlowCtxConfig;
  registryFlowConfig: FlowCtxConfig;
}

function requireEnvSeed(env: Env, prefix: string): WalletSeed {
  const seedVar = `${prefix}_SEED`;
  const mnemonicVar = `${prefix}_MNEMONIC`;
  const seed = env[seedVar];
  const mnemonic = env[mnemonicVar];
  if (seed && mnemonic) {
    throw new Error(`Set incompatible environment variables: ${seedVar} and ${mnemonicVar}`)
  } else if (seed) {
    return { type: 'seed', seed };
  } else if (mnemonic) {
    return { type: 'mnemonic', mnemonic };
  } else {
    throw new Error(`Missing environment variables: ${seedVar} or ${mnemonicVar}`);
  }
}

export function getTestConfig(env: Env): TestConfig {
  const networkId = requireEnvVar(env, 'NETWORK_ID');
  const chainSnapshotDir = requireEnvVar(env, 'CHAIN_SNAPSHOT_DIR');
  const cachedWalletStateDir = requireEnvVar(env, 'CACHED_WALLET_STATE_DIR');
  const chainSnapshot = loadChainSnapshot(networkId, chainSnapshotDir);
  return {
    networkId,
    cesUrl: requireEnvVar(env, 'CES_URL'),
    counterAddress: requireEnvVar(env, 'COUNTER_ADDRESS'),
    tokenMintAddress: requireEnvVar(env, 'TOKEN_MINT_ADDRESS'),
    derivedTokenColor: requireEnvVar(env, 'DERIVED_TOKEN_COLOR'),
    chainSnapshotDir,
    chainSnapshot,
    sponsorFlowConfig: {
      seed: requireEnvSeed(env, 'SPONSOR_WALLET'),
      stateSource: { kind: 'inMemory', chainSnapshot },
    },
    exchangeFlowConfig: {
      seed: requireEnvSeed(env, 'EXCHANGE_WALLET'),
      stateSource: { kind: 'inMemory', chainSnapshot },
    },
    registryFlowConfig: {
      seed: requireEnvSeed(env, 'REGISTRY_WALLET'),
      stateSource: { kind: 'onDisk', walletStateDir: cachedWalletStateDir },
    },
  };
}
