import type pino from 'pino';
import { config as loadDotenv } from 'dotenv';
import type { NetworkEndpoints, WalletConnection, WalletStateStore } from '@capacity-exchange/midnight-core';
import { loadPriceConfig, type PriceFormula, type FundedContract } from './config/prices.js';
import { parseAppEnv } from './config/env.js';
import { createServerLogger } from './config/logger.js';
import { resolveNetwork } from './config/network.js';
import { createWalletResources } from './config/wallet.js';

export interface AppConfig {
  MIDNIGHT_NETWORK: string;
  WALLET_SEED_FILE?: string;
  WALLET_MNEMONIC_FILE?: string;
  PRICE_CONFIG_FILE: string;
  PORT: number;
  LOG_LEVEL: string;
  OFFER_TTL_SECONDS: number;
  PROOF_SERVER_URL?: string;
  WALLET_STATE_DIR: string;
  endpoints: NetworkEndpoints;
  PRICE_FORMULAS: PriceFormula[];
  FUNDED_CONTRACTS: FundedContract[];
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
  const network = resolveNetwork(env.MIDNIGHT_NETWORK, env.PROOF_SERVER_URL);

  const [priceConfig, wallet] = await Promise.all([
    loadPriceConfig(env.PRICE_CONFIG_FILE),
    createWalletResources(env, network, logger),
  ]);

  const config: AppConfig = {
    ...env,
    endpoints: network.endpoints,
    PRICE_FORMULAS: priceConfig.priceFormulas,
    FUNDED_CONTRACTS: priceConfig.fundedContracts,
    walletConnection: wallet.walletConnection,
    walletStateStore: wallet.walletStateStore,
  };

  return { config, logger };
}
