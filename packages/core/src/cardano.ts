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
  const whole = lovelace / BigInt(LOVELACE_PER_ADA);
  const frac = lovelace % BigInt(LOVELACE_PER_ADA);
  return `${whole}.${frac.toString().padStart(ADA_DECIMALS, '0')}`;
}

export function adaToLovelace(ada: number): bigint {
  return BigInt(Math.round(ada * LOVELACE_PER_ADA));
}

export function createProvider(config: NetworkConfig): Provider {
  return new Blockfrost({
    network: config.blockfrostNetwork,
    projectId: config.blockfrostProjectId,
  });
}
