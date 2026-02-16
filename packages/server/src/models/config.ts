import { PriceFormula } from '../services/price.js';
import { WalletContext } from '../utils/wallet.js';

export interface BaseConfig {
  MIDNIGHT_NETWORK: string;
  NODE_URL: string;
  NODE_WS_URL: string;
  INDEXER_URL: string;
  INDEXER_WS_URL: string;
  PROOF_SERVER_URL: string;
  WALLET_SEED_FILE?: string;
  WALLET_MNEMONIC_FILE?: string;
  PRICE_FORMULAS_FILE: string;
  PORT: number;
  LOG_LEVEL: string;
  OFFER_TTL_SECONDS: number;
}

export interface AppConfig extends BaseConfig {
  WALLET_SEED: string;
  DUST_WALLET_STATE_FILE: string;
  PRICE_FORMULAS: PriceFormula[];
  walletContext: WalletContext;
}

export const schema = {
  type: 'object',
  required: [
    'MIDNIGHT_NETWORK',
    'NODE_URL',
    'NODE_WS_URL',
    'INDEXER_URL',
    'INDEXER_WS_URL',
    'PROOF_SERVER_URL',
    'PRICE_FORMULAS_FILE',
    'PORT',
    'LOG_LEVEL',
    'OFFER_TTL_SECONDS',
  ],
  properties: {
    MIDNIGHT_NETWORK: {
      type: 'string',
      default: 'testnet',
    },
    NODE_URL: {
      type: 'string',
    },
    NODE_WS_URL: {
      type: 'string',
    },
    INDEXER_URL: {
      type: 'string',
    },
    INDEXER_WS_URL: {
      type: 'string',
    },
    PROOF_SERVER_URL: {
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
