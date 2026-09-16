import { Type } from '@sinclair/typebox';
import { CapacityAssetSchema } from '../config/prices.js';
import { Currency, ErrorResponse } from './common.js';

const Price = Type.Object({
  amount: Type.String(),
  currency: Currency,
});

export const PricesResponse = Type.Object({
  quoteId: Type.String(),
  prices: Type.Array(Price),
});

const PricesRequestQuery = Type.Object({
  // Enforce the string to be one or more digits
  amount: Type.String({ pattern: '^\\d+$' }),
  // The capacity asset being bought. Every asset the software knows about is accepted
  // here; whether this particular server sells it is a runtime 400.
  currency: CapacityAssetSchema,
});

// For /api/prices
export const PricesSchema = {
  schema: {
    querystring: PricesRequestQuery,
    response: {
      200: PricesResponse,
      400: ErrorResponse,
      500: ErrorResponse,
    },
  },
};
