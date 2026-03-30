import { Type } from '@sinclair/typebox';
import { WalletStatus } from './health.js';

const DustUsageSchema = Type.Object({
  totalSpecksConsumed: Type.String(),
  specksLastHour: Type.String(),
  locksLastHour: Type.Number(),
});

const RevenueSchema = Type.Object({
  byCurrency: Type.Record(Type.String(), Type.String()),
});

const ContentionSchema = Type.Object({
  lockedUtxos: Type.Number(),
  totalUtxos: Type.Number(),
  lockedSpecks: Type.String(),
  ratio: Type.Number(),
});

export const MetricsResponse = Type.Object({
  server: Type.Object({
    name: Type.String(),
    version: Type.String(),
    uptime: Type.Number(),
    network: Type.String(),
  }),
  health: Type.Object({
    wallet: WalletStatus,
  }),
  dustUsage: DustUsageSchema,
  revenue: RevenueSchema,
  contention: ContentionSchema,
});

export const MetricsSchema = {
  schema: {
    response: {
      200: MetricsResponse,
    },
  },
};
