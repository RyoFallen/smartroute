import { z } from 'zod';

export const ErrorCode = z.enum([
  'INVALID_INPUT',
  'UNAUTHORIZED',
  'NOT_FOUND',
  'FLIGHT_API_TIMEOUT',
  'FLIGHT_API_UNAVAILABLE',
  'FLIGHT_API_NO_RESULTS',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const ApiError = z.object({
  error: z.object({
    code: ErrorCode,
    message: z.string(),
    details: z.record(z.unknown()).optional(),
  }),
});
export type ApiError = z.infer<typeof ApiError>;
