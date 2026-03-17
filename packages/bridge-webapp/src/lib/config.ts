import { requireBrowserEnv, toNetworkIdEnum, resolveEndpoints } from '@capacity-exchange/midnight-core';
import vaultTokenTypes from '../../vault-token-types.json';

export interface NetworkConfig {
  networkId: string;
  indexerUrl: string;
  indexerWsUrl: string;
  proofServerUrl: string;
}

export function getNetworkConfig(): NetworkConfig {
  const networkId = requireBrowserEnv('VITE_NETWORK_ID');
  const enumId = toNetworkIdEnum(networkId);
  const proofServerOverride = import.meta.env.VITE_PROOF_SERVER_URL;
  const endpoints = resolveEndpoints(enumId, proofServerOverride);
  return {
    networkId,
    indexerUrl: endpoints.indexerHttpUrl,
    indexerWsUrl: endpoints.indexerWsUrl,
    proofServerUrl: endpoints.proofServerUrl,
  };
}

export interface VaultTokenType {
  label: string;
  domainSep: string;
}

export interface VaultConfig {
  contractAddress: string;
  tokenTypes: VaultTokenType[];
}

export function getVaultConfig(): VaultConfig {
  return {
    contractAddress: requireBrowserEnv('VITE_VAULT_CONTRACT_ADDRESS'),
    tokenTypes: vaultTokenTypes,
  };
}
