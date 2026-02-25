import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { MidnightProvider, PrivateStateProvider, PublicDataProvider } from '@midnight-ntwrk/midnight-js-types';
import type { AppConfig } from '@capacity-exchange/core/node';
import {
  checkWebSocket,
  checkIndexerFreshness,
  checkProofServer,
  createPrivateStateProvider,
} from '@capacity-exchange/core/node';
import { WalletContext, createWalletContext } from './wallet-context';

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
