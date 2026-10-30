import { Type } from '@sinclair/typebox';
import { ErrorResponse } from './common.js';

export const CardanoHintsResponse = Type.Array(
  Type.String({
    pattern: '^[0-9a-f]+$',
    description: 'A CIP-0198 signed `hints` set, CBOR as lowercase hex',
  }),
  { title: 'CardanoHintsResponse' },
);

// For /api/cardano/hints
export const CardanoHintsSchema = {
  schema: {
    response: {
      200: CardanoHintsResponse,
      501: ErrorResponse,
    },
  },
};
