import { Type } from '@sinclair/typebox';
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
  specks: Type.String({ pattern: '^\\d+$' }),
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
