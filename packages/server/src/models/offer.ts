import { Type } from '@sinclair/typebox';
import { ErrorResponse } from './common.js';

export const CreateOfferRequest = Type.Object({
  specks: Type.String(),
  offerCurrency: Type.String(),
});

export const CreateOfferResponse = Type.Object({
  offerId: Type.String(),
  offerAmount: Type.String(),
  offerCurrency: Type.String(),
  serializedTx: Type.String(),
  expiresAt: Type.String({ format: 'date-time' }),
});

export const OfferReply = Type.Union([CreateOfferResponse, ErrorResponse]);

// For /api/offers
export const OfferSchema = {
  schema: {
    body: CreateOfferRequest,
    response: {
      201: CreateOfferResponse,
      409: ErrorResponse,
      500: ErrorResponse,
      503: ErrorResponse,
    },
  },
};
