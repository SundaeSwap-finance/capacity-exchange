import { Type } from '@sinclair/typebox';

export const HealthResponse = Type.Object({
  status: Type.Literal('ok'),
  uptime: Type.Number(),
});

// For /health
export const HealthSchema = {
  schema: {
    response: {
      200: HealthResponse,
    },
  },
};

// Note: Don't try to correct these so that IndexerStatus (or WalletStatus) is
// the union of its success and error states--union'ing objects breaks OpenAPI
// spec generation
export const IndexerStatus = Type.Object({
  status: Type.Union([Type.Literal('ok'), Type.Literal('ko')]),
  height: Type.Optional(Type.Number()),
  error: Type.Optional(Type.String()),
  details: Type.Optional(Type.String()),
});

export const WalletStatus = Type.Object({
  status: Type.Union([Type.Literal('syncing'), Type.Literal('ok'), Type.Literal('ko')]),
  error: Type.Optional(Type.String()),
});

export const ReadyResponse = Type.Object({
  status: Type.Union([Type.Literal('syncing'), Type.Literal('ok'), Type.Literal('ko')]),
  wallet: WalletStatus,
  indexer: IndexerStatus,
});

// For /health/ready
// Note: We don't use the ErrorResponse here so that monitoring and alerting
// tools can take advantage of the structured wallet sync and indexer status
// details
export const ReadinessSchema = {
  schema: {
    response: {
      200: ReadyResponse,
      500: ReadyResponse,
      503: ReadyResponse,
    },
  },
};
