import { Type } from '@sinclair/typebox';

export const RootResponse = Type.Object({
  name: Type.String(),
  version: Type.String(),
  env: Type.Object({
    network: Type.String(),
    node_url: Type.String(),
    node_ws_url: Type.String(),
    indexer_url: Type.String(),
    indexer_ws_url: Type.String(),
    proof_server_url: Type.String(),
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
