import { Type } from '@sinclair/typebox';

export const RootResponse = Type.Object({
  name: Type.String(),
  version: Type.String(),
  // Null when no Midnight network is configured (e.g. an ADA-only server).
  env: Type.Object({
    network: Type.Union([Type.String(), Type.Null()]),
    node_url: Type.Union([Type.String(), Type.Null()]),
    node_ws_url: Type.Union([Type.String(), Type.Null()]),
    indexer_url: Type.Union([Type.String(), Type.Null()]),
    indexer_ws_url: Type.Union([Type.String(), Type.Null()]),
    proof_server_url: Type.Union([Type.String(), Type.Null()]),
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
