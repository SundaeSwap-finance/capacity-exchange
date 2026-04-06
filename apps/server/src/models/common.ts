import { Type } from '@sinclair/typebox';

// Generic error response shape
export const ErrorResponse = Type.Object({
  error: Type.String(),
  message: Type.String(),
  details: Type.Optional(Type.String()),
});
