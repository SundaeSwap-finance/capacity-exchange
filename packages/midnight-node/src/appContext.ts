import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { MidnightProvider, PrivateStateProvider, PublicDataProvider } from '@midnight-ntwrk/midnight-js-types';
import type { AppConfig, NetworkConfig } from './appConfig.js';
import { checkWebSocket, checkIndexerFreshness, checkProofServer } from './connectivity.js';
import { createPrivateStateProvider } from './levelPrivateStateProvider.js';
import { WalletContext, createWalletContext } from './walletContext.js';

/**
 * Builds a read-only `PublicDataProvider` from a `NetworkConfig` without wallet
 * bootstrap. Use for read-only CLIs querying public contract state.
 * TODO: fold into a proper `withNetworkContext`/`withNetworkContextFromEnv`
 * helper alongside the `AppContext` rework so read-only callers don't have
 * to assemble providers by hand.
 */
export function createPublicDataProvider(network: NetworkConfig): PublicDataProvider {
  const { indexerHttpUrl, indexerWsUrl } = network.endpoints;
  return indexerPublicDataProvider(indexerHttpUrl, indexerWsUrl);
}

export interface AppContext {
  config: AppConfig;
  privateStateProvider: PrivateStateProvider;
  publicDataProvider: PublicDataProvider;
  midnightProvider: MidnightProvider;
  walletContext: WalletContext;
}

export async function createAppContext(config: AppConfig): Promise<AppContext> {
  const { nodeUrl, proofServerUrl, indexerHttpUrl, indexerWsUrl } = config.network.endpoints;

  await Promise.all([checkWebSocket(nodeUrl), checkProofServer(proofServerUrl), checkIndexerFreshness(indexerHttpUrl)]);

  const walletContext = await createWalletContext(config);

  const midnightProvider: MidnightProvider = {
    async submitTx(tx) {
      await walletContext.walletFacade.submitTransaction(tx);
      return tx.identifiers()[0];
    },
  };

  return {
    config,
    privateStateProvider: createPrivateStateProvider(),
    publicDataProvider: indexerPublicDataProvider(indexerHttpUrl, indexerWsUrl),
    midnightProvider,
    walletContext,
  };
}
