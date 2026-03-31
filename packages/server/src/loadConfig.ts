import type pino from 'pino';
import { config as loadDotenv } from 'dotenv';
import { toNetworkIdEnum, resolveEndpoints, type NetworkEndpoints, type WalletConnection, type WalletStateStore } from '@capacity-exchange/midnight-core';
import type { NetworkId } from '@midnight-ntwrk/wallet-sdk-abstractions';
import { loadPriceConfig, type PriceFormula, type SponsoredContract } from './config/prices.js';
import { parseAppEnv } from './config/env.js';
import { createServerLogger } from './config/logger.js';
import { createWalletResources } from './config/wallet.js';

export interface AppConfig {
  networkId: NetworkId.NetworkId;
  port: number;
  quoteTtlSeconds: number;
  offerTtlSeconds: number;
  endpoints: NetworkEndpoints;
  priceFormulas: PriceFormula[];
  sponsorAll: boolean;
  sponsoredContracts: SponsoredContract[];
  quoteSecretFile: string;
  walletConnection: WalletConnection;
  walletStateStore: WalletStateStore;
}

export interface ServerBootstrap {
  config: AppConfig;
  logger: pino.Logger;
}

/** Load env, create the logger, validate and build all server config. */
export async function loadConfig(): Promise<ServerBootstrap> {
  loadDotenv({ path: process.env.DOTENV_CONFIG_PATH });
  const logger = createServerLogger();
  const env = parseAppEnv();
  const networkId = toNetworkIdEnum(env.MIDNIGHT_NETWORK);
  const endpoints = resolveEndpoints(networkId, env.PROOF_SERVER_URL);

  const priceConfig = loadPriceConfig(env.PRICE_CONFIG_FILE);
  const wallet = await createWalletResources(env, networkId, logger);

  const config: AppConfig = {
    networkId,
    port: env.PORT,
    quoteTtlSeconds: env.QUOTE_TTL_SECONDS,
    offerTtlSeconds: env.OFFER_TTL_SECONDS,
    endpoints,
    priceFormulas: priceConfig.priceFormulas,
    quoteSecretFile: env.QUOTE_SECRET_FILE,
    sponsorAll: priceConfig.sponsorAll ?? false,
    sponsoredContracts: priceConfig.sponsoredContracts,
    walletConnection: wallet.walletConnection,
    walletStateStore: wallet.walletStateStore,
  };

  return { config, logger };
}
