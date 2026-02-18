import { Blockfrost, type Provider } from '@blaze-cardano/sdk';

export type CardanoNetwork = 'mainnet' | 'preprod' | 'preview';
export type BlockfrostNetworkName = 'cardano-mainnet' | 'cardano-preprod' | 'cardano-preview';

export interface NetworkConfig {
  network: CardanoNetwork;
  blockfrostNetwork: BlockfrostNetworkName;
  blockfrostProjectId: string;
}

export function toBlockfrostNetworkName(network: CardanoNetwork): BlockfrostNetworkName {
  return `cardano-${network}`;
}

export const LOVELACE_PER_ADA = 1_000_000;
export const ADA_DECIMALS = 6;

export function lovelaceToAda(lovelace: bigint): string {
  return (Number(lovelace) / LOVELACE_PER_ADA).toFixed(ADA_DECIMALS);
}

export function createProvider(config: NetworkConfig): Provider {
  return new Blockfrost({
    network: config.blockfrostNetwork,
    projectId: config.blockfrostProjectId,
  });
}
