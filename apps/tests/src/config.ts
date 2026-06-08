import { loadChainSnapshot, requireEnvVar, type Env } from '@sundaeswap/capacity-exchange-nodejs';
import type { ChainSnapshot } from '@sundaeswap/capacity-exchange-core';
import { requireEnvSeed, type FlowCtxConfig } from './util/testUtils.js';

export interface BaseTestConfig {
  networkId: string;
  cesUrl: string;
  counterAddress: string;
  chainSnapshotDir: string;
  chainSnapshot: ChainSnapshot | undefined;
  exchangeFlowConfig: FlowCtxConfig;
  cesServerFlowConfig: FlowCtxConfig;
}

export interface TestConfig extends BaseTestConfig {
  tokenMintAddress: string;
  derivedTokenColor: string;
  sponsorFlowConfig: FlowCtxConfig;
  registryFlowConfig: FlowCtxConfig;
}

export function getBaseTestConfig(env: Env): BaseTestConfig {
  const networkId = requireEnvVar(env, 'NETWORK_ID');
  const chainSnapshotDir = requireEnvVar(env, 'CHAIN_SNAPSHOT_DIR');
  const chainSnapshot = loadChainSnapshot(networkId, chainSnapshotDir);
  return {
    networkId,
    cesUrl: requireEnvVar(env, 'CES_URL'),
    counterAddress: requireEnvVar(env, 'COUNTER_ADDRESS'),
    chainSnapshotDir,
    chainSnapshot,
    exchangeFlowConfig: {
      seed: requireEnvSeed(env, 'EXCHANGE_WALLET'),
      stateSource: { kind: 'inMemory', chainSnapshot },
    },
    cesServerFlowConfig: {
      seed: requireEnvSeed(env, 'CES_SERVER_WALLET'),
      stateSource: { kind: 'inMemory', chainSnapshot },
    },
  };
}

export function getTestConfig(env: Env): TestConfig {
  const base = getBaseTestConfig(env);
  const cachedWalletStateDir = requireEnvVar(env, 'CACHED_WALLET_STATE_DIR');
  return {
    ...base,
    tokenMintAddress: requireEnvVar(env, 'TOKEN_MINT_ADDRESS'),
    derivedTokenColor: requireEnvVar(env, 'DERIVED_TOKEN_COLOR'),
    sponsorFlowConfig: {
      seed: requireEnvSeed(env, 'SPONSOR_WALLET'),
      stateSource: { kind: 'inMemory', chainSnapshot: base.chainSnapshot },
    },
    registryFlowConfig: {
      seed: requireEnvSeed(env, 'REGISTRY_WALLET'),
      stateSource: { kind: 'onDisk', walletStateDir: cachedWalletStateDir },
    },
  };
}
