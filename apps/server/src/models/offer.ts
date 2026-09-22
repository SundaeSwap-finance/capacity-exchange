import { Type } from '@sinclair/typebox';
import { Currency, ErrorResponse } from './common.js';

export const CreateOfferRequest = Type.Object({
  quoteId: Type.String({ minLength: 1 }),
  offerCurrency: Type.String({ minLength: 1 }),
});

export const CreateOfferResponse = Type.Object({
  offerId: Type.String(),
  offerAmount: Type.String(),
  offerCurrency: Currency,
  serializedTx: Type.String(),
  expiresAt: Type.String({ format: 'date-time' }),
});

export const OfferReply = Type.Union([CreateOfferResponse, ErrorResponse]);

const commonOfferResponse = {
  201: CreateOfferResponse,
  400: ErrorResponse,
  409: ErrorResponse,
  410: ErrorResponse,
  // Returned when the capacity asset this route settles (DUST) isn't configured
  // on this server — e.g. an ADA-only server with no Midnight network.
  501: ErrorResponse,
  500: ErrorResponse,
  503: ErrorResponse,
};

// For /api/offers
export const OfferSchema = {
  schema: {
    body: CreateOfferRequest,
    response: commonOfferResponse,
  },
};

export const AdaCreateOfferRequest = Type.Object({
  quoteId: Type.String({ minLength: 1 }),
  offerCurrency: Type.String({ minLength: 1 }),
  utxoTxHash: Type.String({
    minLength: 64,
    maxLength: 64,
    pattern: '^[0-9a-fA-F]{64}$',
    description: 'Cardano transaction hash (64 hex chars) containing the UTXO',
  }),
  senderAddress: Type.String({
    minLength: 1,
    description:
      'Cardano address of the sender; at least one transaction input must originate from this address',
  }),
  expectedValue: Type.String({
    minLength: 1,
    description:
      'The lovelace value (decimal string) the sender sends, disregarding the network fee',
  }),
});

// For /api/ada/offers
export const AdaOfferSchema = {
  schema: {
    body: AdaCreateOfferRequest,
    response: {
      ...commonOfferResponse,
      // Returned when Cardano payment verification (not just DUST offers) isn't
      // configured on this server — see commonOfferResponse's 501 for that case.
      404: ErrorResponse,
    },
  },
};
