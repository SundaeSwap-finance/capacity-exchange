import { NetworkId } from '@midnight-ntwrk/wallet-sdk-abstractions';

export interface AppConfig {
  networkId: NetworkId.NetworkId;
  nodeUrl: string;
  proofServerUrl: string;
  indexerHttpUrl: string;
  indexerWsUrl: string;
  seed: Buffer;
}
