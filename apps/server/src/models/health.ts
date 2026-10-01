import { Type, type Static } from '@sinclair/typebox';

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
  // 'disabled' means no Midnight network is configured on this server (e.g. ADA-only).
  status: Type.Union([Type.Literal('ok'), Type.Literal('ko'), Type.Literal('disabled')]),
  height: Type.Optional(Type.Number()),
  error: Type.Optional(Type.String()),
  details: Type.Optional(Type.String()),
});

export const WalletStatus = Type.Object({
  status: Type.Union([
    Type.Literal('syncing'),
    Type.Literal('ok'),
    Type.Literal('ko'),
    Type.Literal('disabled'),
  ]),
  error: Type.Optional(Type.String()),
});

export const ChainStatus = Type.Object({
  // 'syncing' means the chain source is reachable but its tip is stale.
  status: Type.Union([
    Type.Literal('syncing'),
    Type.Literal('ok'),
    Type.Literal('ko'),
    Type.Literal('disabled'),
  ]),
  slot: Type.Optional(Type.Number()),
  tipAgeMs: Type.Optional(Type.Number()),
  error: Type.Optional(Type.String()),
});

/** A chain the server follows, as the readiness check sees it. */
export interface ChainHealth {
  health(): Static<typeof ChainStatus>;
}

export const MidnightStatus = Type.Object({
  wallet: WalletStatus,
  indexer: IndexerStatus,
});

export const ReadyResponse = Type.Object({
  status: Type.Union([Type.Literal('syncing'), Type.Literal('ok'), Type.Literal('ko')]),
  midnight: MidnightStatus,
  cardano: ChainStatus,
});

// For /health/ready
// Note: We don't use the ErrorResponse here so that monitoring and alerting
// tools can take advantage of the structured per-chain status details
export const ReadinessSchema = {
  schema: {
    response: {
      200: ReadyResponse,
      500: ReadyResponse,
      503: ReadyResponse,
    },
  },
};
