import { Type } from '@sinclair/typebox';
import { ErrorResponse } from './common.js';

export const SponsorRequest = Type.Object({
  provenTx: Type.String({ minLength: 1, pattern: '^[0-9a-fA-F]+$' }),
});

export const SponsorResponse = Type.Object({
  tx: Type.String(),
});

export const SponsorReply = Type.Union([SponsorResponse, ErrorResponse]);

export const SponsorSchema = {
  schema: {
    body: SponsorRequest,
    response: {
      200: SponsorResponse,
      422: ErrorResponse,
      500: ErrorResponse,
      503: ErrorResponse,
    },
  },
};
