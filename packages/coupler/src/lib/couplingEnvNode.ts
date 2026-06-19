import type { AppContext } from '@sundaeswap/capacity-exchange-nodejs';
import type { ZKConfigProvider } from '@midnight-ntwrk/midnight-js-types';
import type { Logger } from '@sundaeswap/capacity-exchange-core';
import type { CouplingEnv } from './env.js';

/** Nodejs adapter: builds a CouplingEnv from an AppContext, a zk-keys source, and a logger. */
export function couplingEnvFromAppContext(
  ctx: AppContext,
  zkConfigProvider: ZKConfigProvider<string>,
  logger: Logger
): CouplingEnv {
  return {
    coinPublicKey: ctx.walletContext.walletProvider.getCoinPublicKey(),
    publicDataProvider: ctx.publicDataProvider,
    privateStateProvider: ctx.privateStateProvider,
    midnightProvider: ctx.midnightProvider,
    zkConfigProvider,
    proofServerUrl: ctx.config.network.endpoints.proofServerUrl,
    indexerHttpUrl: ctx.config.network.endpoints.indexerHttpUrl,
    logger,
  };
}
