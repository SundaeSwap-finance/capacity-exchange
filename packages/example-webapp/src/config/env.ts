function getRequiredEnvVar(name: string): string {
  const value = import.meta.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  capacityExchangeUrl: getRequiredEnvVar('VITE_CAPACITY_EXCHANGE_URL'),
  indexerUrl: getRequiredEnvVar('VITE_INDEXER_URL'),
  proofServerUrl: getRequiredEnvVar('VITE_PROOF_SERVER_URL'),
  nodeWsUrl: getRequiredEnvVar('VITE_NODE_WS_URL'),
  networkId: getRequiredEnvVar('VITE_NETWORK_ID'),
} as const;

export type Config = typeof config;
