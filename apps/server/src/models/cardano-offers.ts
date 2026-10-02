import { Type } from '@sinclair/typebox';
import { ErrorResponse } from './common.js';

export const RejectionCode = Type.Union(
  [
    Type.Literal('malformed'),
    Type.Literal('unsupported-version'),
    Type.Literal('not-interested'),
    Type.Literal('over-budget'),
    Type.Literal('duplicate'),
    Type.Literal('settled'),
    Type.Literal('expired'),
    Type.Literal('invalidated'),
    Type.Literal('superseded'),
    Type.Literal('busy'),
    Type.Literal('not-ready'),
  ],
  { title: 'CardanoOfferRejectionCode' },
);

export const OfferRejection = Type.Object(
  { code: RejectionCode, message: Type.String() },
  { title: 'CardanoOfferRejection' },
);

export const SubmitCardanoOfferRequest = Type.Object(
  {
    envelope: Type.String({
      pattern: '^[0-9a-fA-F]+$',
      description:
        'Hex of the CIP-0198 envelope `[envelope_version, era_tag, #6.24(sub_transaction)]`',
    }),
    quoteId: Type.Optional(
      Type.String({ description: 'Ignored: offers that move ADA alone carry no price' }),
    ),
  },
  { title: 'SubmitCardanoOfferRequest' },
);

export const CardanoOfferStatus = Type.Object(
  {
    offerId: Type.String({ description: "The offer's TxId: the hash of its body as encoded" }),
    state: Type.Union([
      Type.Literal('received'),
      Type.Literal('verified'),
      Type.Literal('included-in-batch'),
      Type.Literal('submitted'),
      Type.Literal('rejected'),
    ]),
    batchTxId: Type.Optional(Type.String()),
    reason: Type.Optional(OfferRejection),
  },
  { title: 'CardanoOfferStatus' },
);

// Hidden from the OpenAPI spec, and so from the generated client, while the route is a prototype.
export const SubmitCardanoOfferSchema = {
  schema: {
    hide: true,
    body: SubmitCardanoOfferRequest,
    response: {
      202: CardanoOfferStatus,
      400: OfferRejection,
      409: OfferRejection,
      422: OfferRejection,
      501: ErrorResponse,
    },
  },
};

export const CardanoOfferStatusSchema = {
  schema: {
    hide: true,
    params: Type.Object({ offerId: Type.String() }),
    response: { 200: CardanoOfferStatus, 404: ErrorResponse, 501: ErrorResponse },
  },
};
