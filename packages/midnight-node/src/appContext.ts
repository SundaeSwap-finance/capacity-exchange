import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { MidnightProvider, PrivateStateProvider, PublicDataProvider } from '@midnight-ntwrk/midnight-js-types';
import type { AppConfig } from './appConfig';
import { checkWebSocket, checkIndexerFreshness, checkProofServer } from './connectivity';
import { createPrivateStateProvider } from './levelPrivateStateProvider';
import { WalletContext, createWalletContext } from './walletContext';

export interface AppContext {
  privateStateProvider: PrivateStateProvider;
  publicDataProvider: PublicDataProvider;
  midnightProvider: MidnightProvider;
  walletContext: WalletContext;
  proofServerUrl: string;
}

export async function createAppContext(config: AppConfig): Promise<AppContext> {
  const { nodeUrl, proofServerUrl, indexerHttpUrl, indexerWsUrl } = config.endpoints;

  await Promise.all([checkWebSocket(nodeUrl), checkProofServer(proofServerUrl), checkIndexerFreshness(indexerHttpUrl)]);

  const walletContext = await createWalletContext(config);

  const midnightProvider: MidnightProvider = {
    async submitTx(tx) {
      await walletContext.walletFacade.submitTransaction(tx);
      return tx.identifiers()[0];
    },
  };

  return {
    privateStateProvider: createPrivateStateProvider(),
    publicDataProvider: indexerPublicDataProvider(indexerHttpUrl, indexerWsUrl),
    midnightProvider,
    walletContext,
    proofServerUrl,
  };
}
