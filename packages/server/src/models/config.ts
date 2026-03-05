import {
  NetworkEndpoints,
  WalletConnection,
  type WalletStateStore,
} from '@capacity-exchange/midnight-core';
import { Static, Type } from '@sinclair/typebox';

export const PriceFormulaSchema = Type.Object({
  currency: Type.String(),
  basePrice: Type.String(),
  rateNumerator: Type.String(),
  rateDenominator: Type.String(),
});

export type PriceFormula = Static<typeof PriceFormulaSchema>;

const CircuitFilterSchema = Type.Union([
  Type.Object({ type: Type.Literal('all') }),
  Type.Object({ type: Type.Literal('subset'), circuitNames: Type.Array(Type.String()) }),
]);

const FundedContractSchema = Type.Object({
  contractAddress: Type.String(),
  circuits: CircuitFilterSchema,
});

export type FundedContract = Static<typeof FundedContractSchema>;

// I think we may need a better name than PriceConfig
export const PriceConfigSchema = Type.Object({
  priceFormulas: Type.Array(PriceFormulaSchema),
  fundedContracts: Type.Array(FundedContractSchema),
});

export type PriceConfig = Static<typeof PriceConfigSchema>;

export interface BaseConfig {
  MIDNIGHT_NETWORK: string;
  WALLET_SEED_FILE?: string;
  WALLET_MNEMONIC_FILE?: string;
  PRICE_CONFIG_FILE: string;
  PORT: number;
  LOG_LEVEL: string;
  OFFER_TTL_SECONDS: number;
  PROOF_SERVER_URL: string;
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
    'PROOF_SERVER_URL',
    'WALLET_STATE_DIR',
  ],
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
