import {
  NetworkEndpoints,
  WalletConnection,
  type WalletStateStore,
} from '@capacity-exchange/midnight-core';
import type { PriceFormula, FundedContract } from '../config/prices.js';

export type { PriceFormula, FundedContract, PriceConfig } from '../config/prices.js';

export interface BaseConfig {
  MIDNIGHT_NETWORK: string;
  WALLET_SEED_FILE?: string;
  WALLET_MNEMONIC_FILE?: string;
  PRICE_CONFIG_FILE: string;
  PORT: number;
  LOG_LEVEL: string;
  OFFER_TTL_SECONDS: number;
  PROOF_SERVER_URL?: string;
  WALLET_STATE_DIR: string;
}

export interface AppConfig extends BaseConfig {
  endpoints: NetworkEndpoints;
  WALLET_SEED: string;
  PRICE_FORMULAS: PriceFormula[];
  FUNDED_CONTRACTS: FundedContract[];
  walletConnection: WalletConnection;
  walletStateStore: WalletStateStore;
}

export const schema = {
  type: 'object',
  required: [
    'MIDNIGHT_NETWORK',
    'PRICE_CONFIG_FILE',
    'PORT',
    'LOG_LEVEL',
    'OFFER_TTL_SECONDS',
    'WALLET_STATE_DIR',
  ],
  properties: {
    MIDNIGHT_NETWORK: {
      type: 'string',
    },
    WALLET_SEED_FILE: {
      type: 'string',
    },
    WALLET_MNEMONIC_FILE: {
      type: 'string',
    },
    PRICE_CONFIG_FILE: {
      type: 'string',
    },
    PORT: {
      type: 'number',
    },
    LOG_LEVEL: {
      type: 'string',
    },
    OFFER_TTL_SECONDS: {
      type: 'number',
    },
    PROOF_SERVER_URL: {
      type: 'string',
    },
    WALLET_STATE_DIR: {
      type: 'string',
    },
  },
};
