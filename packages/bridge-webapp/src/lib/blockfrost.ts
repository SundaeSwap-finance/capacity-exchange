import type { Provider } from '@blaze-cardano/sdk';
import {
  requireBrowserEnv,
  createProvider,
  toBlockfrostNetworkName,
  type CardanoNetwork,
} from '@capacity-exchange/core';

const VALID_NETWORKS: CardanoNetwork[] = ['mainnet', 'preprod', 'preview'];

export function getCardanoNetwork(): CardanoNetwork {
  const value = requireBrowserEnv('VITE_NETWORK_ID');
  if (!VALID_NETWORKS.includes(value as CardanoNetwork)) {
    throw new Error(`VITE_NETWORK_ID must be one of ${VALID_NETWORKS.join(', ')}, got: ${value}`);
  }
  return value as CardanoNetwork;
}

export function getBridgeDepositAddress(): string {
  return requireBrowserEnv('VITE_BRIDGE_DEPOSIT_ADDRESS');
}

export function createBlockfrostProvider(): { provider: Provider; network: CardanoNetwork } {
  const network = getCardanoNetwork();
  const projectId = requireBrowserEnv('VITE_BLOCKFROST_PROJECT_ID');
  const blockfrostNetwork = toBlockfrostNetworkName(network);
  const provider = createProvider({ network, blockfrostNetwork, blockfrostProjectId: projectId });
  return { provider, network };
}
