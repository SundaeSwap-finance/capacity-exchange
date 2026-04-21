import { requireEnvVar, type Env } from '@sundaeswap/capacity-exchange-nodejs';
import type { FlowCtxConfig } from './util/testUtils.js';

export interface TestConfig {
  networkId: string;
  cesUrl: string;
  counterAddress: string;
  tokenMintAddress: string;
  derivedTokenColor: string;
  chainSnapshotDir: string;
  sponsorFlowConfig: FlowCtxConfig;
  exchangeFlowConfig: FlowCtxConfig;
  registryFlowConfig: FlowCtxConfig;
}

export function getTestConfig(env: Env): TestConfig {
  const networkId = requireEnvVar(env, 'NETWORK_ID');
  const tempWalletStateDir = requireEnvVar(env, 'TEMP_WALLET_STATE_DIR');
  const cachedWalletStateDir = requireEnvVar(env, 'CACHED_WALLET_STATE_DIR');
  return {
    networkId,
    cesUrl: requireEnvVar(env, 'CES_URL'),
    counterAddress: requireEnvVar(env, 'COUNTER_ADDRESS'),
    tokenMintAddress: requireEnvVar(env, 'TOKEN_MINT_ADDRESS'),
    derivedTokenColor: requireEnvVar(env, 'DERIVED_TOKEN_COLOR'),
    chainSnapshotDir: requireEnvVar(env, 'CHAIN_SNAPSHOT_DIR'),
    sponsorFlowConfig: {
      mnemonic: requireEnvVar(env, 'SPONSOR_WALLET_MNEMONIC'),
      walletStateDir: tempWalletStateDir,
    },
    exchangeFlowConfig: {
      mnemonic: requireEnvVar(env, 'EXCHANGE_WALLET_MNEMONIC'),
      walletStateDir: tempWalletStateDir,
    },
    registryFlowConfig: {
      mnemonic: requireEnvVar(env, 'REGISTRY_WALLET_MNEMONIC'),
      walletStateDir: cachedWalletStateDir,
    },
  };
}
