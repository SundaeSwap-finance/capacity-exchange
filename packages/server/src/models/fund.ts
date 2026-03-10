import { Type } from '@sinclair/typebox';
import { ErrorResponse } from './common.js';

export const FundRequest = Type.Object({
  provenTx: Type.String(),
});

export const FundResponse = Type.Object({
  tx: Type.String(),
});

export const FundReply = Type.Union([FundResponse, ErrorResponse]);

export const FundSchema = {
  schema: {
    body: FundRequest,
    response: {
      200: FundResponse,
      422: ErrorResponse,
      500: ErrorResponse,
      503: ErrorResponse,
    },
  },
};
