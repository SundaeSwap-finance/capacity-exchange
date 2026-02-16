import { Type } from '@sinclair/typebox';
import { ErrorResponse } from './common.js';

const Price = Type.Object({
  amount: Type.String(),
  currency: Type.String(),
});

export const PricesResponse = Type.Object({
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
