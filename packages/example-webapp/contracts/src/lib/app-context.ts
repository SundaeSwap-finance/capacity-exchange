import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { MidnightProvider, PrivateStateProvider, PublicDataProvider } from '@midnight-ntwrk/midnight-js-types';
import type { AppConfig } from './config/types.js';
import { checkWebSocket, checkIndexerFreshness, checkProofServer } from './connectivity.js';
import { createMidnightProvider } from './providers/midnight.js';
import { createPrivateStateProvider } from './providers/private-state.js';
import { WalletContext, createWalletContext } from './wallet/context.js';

export interface AppContext {
  privateStateProvider: PrivateStateProvider;
  publicDataProvider: PublicDataProvider;
  midnightProvider: MidnightProvider;
  walletContext: WalletContext;
  proofServerUrl: string;
}

export async function createAppContext(config: AppConfig): Promise<AppContext> {
  const { nodeUrl, proofServerUrl, indexerHttpUrl, indexerWsUrl } = config;

  await Promise.all([
    checkWebSocket(nodeUrl),
    checkProofServer(proofServerUrl),
    checkIndexerFreshness(indexerHttpUrl),
  ]);

  const [midnightProvider, walletContext] = await Promise.all([
    createMidnightProvider(nodeUrl),
    createWalletContext(config),
  ]);

  return {
    privateStateProvider: createPrivateStateProvider(),
    publicDataProvider: indexerPublicDataProvider(indexerHttpUrl, indexerWsUrl),
    midnightProvider,
    walletContext,
    proofServerUrl,
  };
}
