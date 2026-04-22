import { requireEnvVar, type Env } from '@sundaeswap/capacity-exchange-nodejs';

export interface TestConfig {
  networkId: string;
  cesUrl: string;
  counterAddress: string;
  tokenMintAddress: string;
  derivedTokenColor: string;
  chainSnapshotDir: string;
}

export function getTestConfig(env: Env): TestConfig {
  return {
    networkId: requireEnvVar(env, 'NETWORK_ID'),
    cesUrl: requireEnvVar(env, 'CES_URL'),
    counterAddress: requireEnvVar(env, 'COUNTER_ADDRESS'),
    tokenMintAddress: requireEnvVar(env, 'TOKEN_MINT_ADDRESS'),
    derivedTokenColor: requireEnvVar(env, 'DERIVED_TOKEN_COLOR'),
    chainSnapshotDir: requireEnvVar(env, 'CHAIN_SNAPSHOT_DIR'),
  };
}
