import { Type } from '@sinclair/typebox';
import { CapacityAssetSchema } from '../config/prices.js';
import { Currency, ErrorResponse } from './common.js';

// Titled so the generated client names these models after what they are, not after whichever
// per-chain route happens to come first.
const Price = Type.Object(
  {
    amount: Type.String(),
    currency: Currency,
  },
  { title: 'Price' },
);

export const PricesResponse = Type.Object(
  {
    quoteId: Type.String(),
    prices: Type.Array(Price),
  },
  { title: 'PricesResponse' },
);

// Enforce the string to be one or more digits
const Amount = Type.String({ pattern: '^\\d+$' });

const PricesRequestQuery = Type.Object({
  amount: Amount,
  // The capacity asset being bought. Every asset the software knows about is accepted
  // here; whether this particular server sells it is a runtime 400.
  currency: CapacityAssetSchema,
});

// For /api/prices. Hidden from the OpenAPI spec in favour of the per-chain routes.
export const PricesSchema = {
  schema: {
    hide: true,
    querystring: PricesRequestQuery,
    response: {
      200: PricesResponse,
      400: ErrorResponse,
      500: ErrorResponse,
    },
  },
};

// For /api/<chain>/prices: the same as /api/prices with the capacity asset fixed by the chain.
export const AssetPricesSchema = {
  schema: {
    querystring: Type.Object({ amount: Amount }),
    response: {
      200: PricesResponse,
      400: ErrorResponse,
      500: ErrorResponse,
    },
  },
};
