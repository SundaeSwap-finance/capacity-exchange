import * as crypto from 'crypto';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { MidnightProvider, PrivateStateProvider, PublicDataProvider } from '@midnight-ntwrk/midnight-js-types';
import type { AppConfig, NetworkConfig } from './appConfig.js';
import { checkWebSocket, checkIndexerFreshness, checkProofServer } from './connectivity.js';
import { loadChainSnapshot } from './chainSnapshot.js';
import { createPrivateStateProvider } from './levelPrivateStateProvider.js';
import { WalletContext, createWalletContext } from './walletContext.js';

/** Default sync budget for a fresh snapshot-primed ephemeral wallet. */
const EPHEMERAL_SYNC_TIMEOUT_MS = 600_000;

/** Public data provider for read-only callers; no wallet bootstrap. */
// TODO: wrap in `withNetworkContext` helper.
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

/**
 * AppContext for a brand-new empty wallet (random seed, no dust), primed from
 * the chain snapshot in `snapshotDir` so it syncs from that point rather than
 * genesis. Network and sync timeout are inherited from `base`. Use to model a
 * second party that holds no funds (e.g. the user in a capacity coupling).
 */
export async function createEphemeralAppContext(base: AppContext, snapshotDir: string): Promise<AppContext> {
  const config: AppConfig = {
    network: base.config.network,
    wallet: {
      seed: crypto.randomBytes(32),
      stateSource: {
        kind: 'inMemory',
        chainSnapshot: loadChainSnapshot(base.config.network.networkName, snapshotDir),
      },
      walletSyncTimeoutMs: base.config.wallet.walletSyncTimeoutMs ?? EPHEMERAL_SYNC_TIMEOUT_MS,
    },
  };
  return createAppContext(config);
}
