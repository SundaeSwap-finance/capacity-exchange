import { Type } from '@sinclair/typebox';
import { CapacityAssetSchema } from '../config/prices.js';

// Amounts are strings in the capacity asset's base unit (specks for DUST, lovelace for ADA).
const CapacitySchema = Type.Object({
  asset: CapacityAssetSchema,
  available: Type.String(),
  consumedTotal: Type.String(),
  consumedLastHour: Type.String(),
  locksLastHour: Type.Number(),
  contention: Type.Object({
    lockedUtxos: Type.Number(),
    totalUtxos: Type.Number(),
    lockedAmount: Type.String(),
    ratio: Type.Number(),
    averageRatioLastHour: Type.Number(),
  }),
});

const RevenueSchema = Type.Object({
  byCurrency: Type.Record(Type.String(), Type.String()),
});

export const MetricsResponse = Type.Object({
  server: Type.Object({
    name: Type.String(),
    version: Type.String(),
    uptime: Type.Number(),
  }),
  // One entry per capacity asset this server holds to sell.
  capacity: Type.Array(CapacitySchema),
  revenue: RevenueSchema,
});

export const MetricsSchema = {
  schema: {
    response: {
      200: MetricsResponse,
    },
  },
};
