import type pino from 'pino';
import { config as loadDotenv } from 'dotenv';
import {
  toNetworkIdEnum,
  resolveEndpoints,
  type NetworkEndpoints,
  type WalletConnection,
  type WalletStateStore,
} from '@sundaeswap/capacity-exchange-core';
import type { NetworkId } from '@midnight-ntwrk/wallet-sdk-abstractions';
import {
  loadPriceConfig,
  pricedAssets,
  type CapacityFormulas,
  type PeerConfig,
  type SponsoredContract,
} from './config/prices.js';
import { parseAppEnv } from './config/env.js';
import { createServerLogger } from './config/logger.js';
import { createWalletResources } from './config/wallet.js';

// All these fields are required together: a server either has a fully-configured
// Midnight network or none of it.
export interface MidnightConfig {
  networkId: NetworkId.NetworkId;
  endpoints: NetworkEndpoints;
  walletConnection: WalletConnection;
  walletStateStore: WalletStateStore;
}

export interface AppConfig {
  // Set only when `priceFormulas.DUST` is configured; an ADA-only server has no use for it.
  midnight?: MidnightConfig;
  port: number;
  quoteTtlSeconds: number;
  offerTtlSeconds: number;
  otelServiceName?: string;
  otelEndpoint?: string;
  otelMetricExportIntervalMs?: number;
  priceFormulas: CapacityFormulas;
  sponsorAll: boolean;
  sponsoredContracts: SponsoredContract[];
  peer?: PeerConfig;
  quoteSecretFile: string;
  capacityExchangeUrls: string[];
  blockfrostApiKey?: string;
  blockfrostBaseUrl?: string;
  cardanoServerAddress?: string;
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
  const priceConfig = loadPriceConfig(env.PRICE_CONFIG_FILE);

  // DUST is the only capacity asset this server can actually build/settle offers for
  // today (see OfferService.buildOffer), so Midnight wallet setup is only required
  // when a server prices DUST at all.
  const dustPriced = pricedAssets(priceConfig.priceFormulas).includes('DUST');
  if (dustPriced && !env.MIDNIGHT_NETWORK) {
    throw new Error('MIDNIGHT_NETWORK is required because priceFormulas.DUST is configured');
  }
  if (dustPriced && !env.WALLET_STATE_DIR) {
    throw new Error('WALLET_STATE_DIR is required because priceFormulas.DUST is configured');
  }

  // both `dustPriced` and `MIDNIGHT_NETWORK` are required, so an ADA-only server
  // never sets up a wallet even if one of them is present.
  let midnight: MidnightConfig | undefined;
  if (dustPriced && env.MIDNIGHT_NETWORK) {
    const networkId = toNetworkIdEnum(env.MIDNIGHT_NETWORK);
    const endpoints = resolveEndpoints(networkId, { proofServerUrl: env.PROOF_SERVER_URL });
    const wallet = await createWalletResources(env, networkId, logger);
    midnight = { networkId, endpoints, ...wallet };
  }

  const config: AppConfig = {
    midnight,
    port: env.PORT,
    quoteTtlSeconds: env.QUOTE_TTL_SECONDS,
    offerTtlSeconds: env.OFFER_TTL_SECONDS,
    otelServiceName: env.OTEL_SERVICE_NAME,
    otelEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
    otelMetricExportIntervalMs: env.OTEL_METRIC_EXPORT_INTERVAL_MS,
    priceFormulas: priceConfig.priceFormulas,
    quoteSecretFile: env.QUOTE_SECRET_FILE,
    sponsorAll: priceConfig.sponsorAll ?? false,
    sponsoredContracts: priceConfig.sponsoredContracts,
    peer: priceConfig.peer,
    blockfrostApiKey: env.BLOCKFROST_API_KEY,
    blockfrostBaseUrl: env.BLOCKFROST_BASE_URL,
    cardanoServerAddress: env.CARDANO_SERVER_ADDRESS,
    capacityExchangeUrls: env.CAPACITY_EXCHANGE_PEER_URLS
      ? env.CAPACITY_EXCHANGE_PEER_URLS.split(',')
          .map((u) => u.trim())
          .filter(Boolean)
      : [],
  };

  return { config, logger };
}
