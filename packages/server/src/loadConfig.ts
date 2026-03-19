import type pino from 'pino';
import { config as loadDotenv } from 'dotenv';
import type { NetworkEndpoints, WalletConnection, WalletStateStore } from '@capacity-exchange/midnight-core';
import { loadPriceConfig, type PriceFormula, type FundedContract } from './config/prices.js';
import { parseAppEnv } from './config/env.js';
import { createServerLogger } from './config/logger.js';
import { resolveNetwork } from './config/network.js';
import { createWalletResources } from './config/wallet.js';

export interface AppConfig {
  networkId: string;
  port: number;
  offerTtlSeconds: number;
  endpoints: NetworkEndpoints;
  priceFormulas: PriceFormula[];
  fundedContracts: FundedContract[];
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
  const network = resolveNetwork(env.networkId, env.proofServerUrl);

  const [priceConfig, wallet] = await Promise.all([
    loadPriceConfig(env.priceConfigFile),
    createWalletResources(env, network, logger),
  ]);

  const config: AppConfig = {
    networkId: env.networkId,
    port: env.port,
    offerTtlSeconds: env.offerTtlSeconds,
    endpoints: network.endpoints,
    priceFormulas: priceConfig.priceFormulas,
    fundedContracts: priceConfig.fundedContracts,
    walletConnection: wallet.walletConnection,
    walletStateStore: wallet.walletStateStore,
  };

  return { config, logger };
}
