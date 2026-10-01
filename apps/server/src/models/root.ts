import { Type } from '@sinclair/typebox';
import { CapacityAssetSchema } from '../config/prices.js';

const MidnightInfo = Type.Object({
  network: Type.String(),
  nodeUrl: Type.String(),
  indexerUrl: Type.String(),
  indexerWsUrl: Type.String(),
  proofServerUrl: Type.String(),
});

export const RootResponse = Type.Object({
  name: Type.String(),
  version: Type.String(),
  capacityAssets: Type.Array(CapacityAssetSchema),
  // A chain is present only when this server is configured to use it.
  chains: Type.Object({
    midnight: Type.Optional(MidnightInfo),
  }),
});

// For /
export const RootSchema = {
  schema: {
    response: {
      200: RootResponse,
    },
  },
};
