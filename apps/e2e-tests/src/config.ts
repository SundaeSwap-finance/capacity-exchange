export interface E2eTestConfig {
  networkId: string;
  cesUrl: string;
  counterAddress: string;
  tokenMintAddress: string;
  derivedTokenColor: string;
  registryAddress?: string;
}

export function getE2eTestConfig(): E2eTestConfig {
  return {
    networkId: requireEnv('NETWORK_ID'),
    cesUrl: requireEnv('CES_URL'),
    counterAddress: requireEnv('COUNTER_ADDRESS'),
    tokenMintAddress: requireEnv('TOKEN_MINT_ADDRESS'),
    derivedTokenColor: requireEnv('DERIVED_TOKEN_COLOR'),
    registryAddress: process.env.REGISTRY_ADDRESS,
  };
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}
