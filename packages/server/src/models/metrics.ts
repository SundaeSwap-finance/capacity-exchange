import { Type } from '@sinclair/typebox';
import { WalletStatus } from './health.js';

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
});

export const MetricsSchema = {
  schema: {
    response: {
      200: MetricsResponse,
    },
  },
};
