import { createAndSyncWallet, COST_PARAMS, type WalletKeys } from '@capacity-exchange/midnight-core';
export type { WalletKeys } from '@capacity-exchange/midnight-core';
import type { NetworkId } from '@midnight-ntwrk/wallet-sdk-abstractions';
import type { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import type { NetworkConfig } from '../../../config';

export interface SeedWalletConnection {
  walletFacade: WalletFacade;
  keys: WalletKeys;
  networkId: string;
}

/**
 * Creates and syncs a wallet from a seed.
 */
export async function connectSeedWallet(seedHex: string, config: NetworkConfig): Promise<SeedWalletConnection> {
  const { walletFacade, keys } = await createAndSyncWallet({
    seedHex,
    walletConfig: {
      networkId: config.networkId as NetworkId.NetworkId,
      costParameters: COST_PARAMS,
      relayURL: new URL(config.nodeWsUrl),
      provingServerUrl: new URL(config.proofServerUrl),
      indexerClientConnection: {
        indexerHttpUrl: config.indexerUrl,
        indexerWsUrl: config.indexerWsUrl,
      },
    },
  });

  return { walletFacade, keys, networkId: config.networkId };
}
