import { Type } from '@sinclair/typebox';

// Currency information surfaced from multiple APIs
export const Currency = Type.Object({
  id: Type.String(),
  type: Type.String(),
  identifier: Type.String(),
});

// Generic error response shape
export const ErrorResponse = Type.Object({
  error: Type.String(),
  message: Type.String(),
  details: Type.Optional(Type.String()),
});
