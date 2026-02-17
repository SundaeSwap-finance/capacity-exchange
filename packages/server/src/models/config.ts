import { NetworkEndpoints, WalletConnection } from '@capacity-exchange/core';
import { StateStore } from '@capacity-exchange/core/node';
import { PriceFormula } from '../services/price.js';

export interface BaseConfig {
  MIDNIGHT_NETWORK: string;
  WALLET_SEED_FILE?: string;
  WALLET_MNEMONIC_FILE?: string;
  PRICE_FORMULAS_FILE: string;
  PORT: number;
  LOG_LEVEL: string;
  OFFER_TTL_SECONDS: number;
}

export interface AppConfig extends BaseConfig {
  endpoints: NetworkEndpoints;
  WALLET_SEED: string;
  PRICE_FORMULAS: PriceFormula[];
  walletConnection: WalletConnection;
  walletStateStore: StateStore;
}

export const schema = {
  type: 'object',
  required: ['MIDNIGHT_NETWORK', 'PRICE_FORMULAS_FILE', 'PORT', 'LOG_LEVEL', 'OFFER_TTL_SECONDS'],
  properties: {
    MIDNIGHT_NETWORK: {
      type: 'string',
    },
    // Note: WALLET_SEED_FILE and WALLET_MNEMONIC_FILE are mutually exclusive
    WALLET_SEED_FILE: {
      type: 'string',
    },
    WALLET_MNEMONIC_FILE: {
      type: 'string',
    },
    PRICE_FORMULAS_FILE: {
      type: 'string',
      default: 'price-formulas.json',
    },
    PORT: {
      type: 'number',
      default: 3000,
    },
    LOG_LEVEL: {
      type: 'string',
      default: 'info',
    },
    OFFER_TTL_SECONDS: {
      type: 'number',
      default: 60,
    },
  },
};
