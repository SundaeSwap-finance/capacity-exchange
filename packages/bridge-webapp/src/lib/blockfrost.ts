import type { Provider } from '@blaze-cardano/sdk';
import {
  createProvider,
  toBlockfrostNetworkName,
  type CardanoNetwork,
} from '@capacity-exchange/core';

function requireEnv(name: string): string {
  const value = import.meta.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Add it to a .env file.`);
  }
  return value;
}

export function getCardanoNetwork(): CardanoNetwork {
  return requireEnv('VITE_CARDANO_NETWORK') as CardanoNetwork;
}

export function getDepositAddress(): string {
  return requireEnv('VITE_DEPOSIT_ADDRESS');
}

export function createBlockfrostProvider(): { provider: Provider; network: CardanoNetwork } {
  const network = getCardanoNetwork();
  const projectId = requireEnv('VITE_BLOCKFROST_PROJECT_ID');
  const blockfrostNetwork = toBlockfrostNetworkName(network);
  const provider = createProvider({ network, blockfrostNetwork, blockfrostProjectId: projectId });
  return { provider, network };
}
