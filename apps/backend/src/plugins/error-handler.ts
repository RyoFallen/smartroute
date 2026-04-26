import fp from 'fastify-plugin';
import { ZodError } from 'zod';
import { ApiError } from '../lib/ApiError.js';

export const errorHandlerPlugin = fp(async (app) => {
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ApiError) {
      return reply.status(err.statusCode).send({
        error: { code: err.code, message: err.message, details: err.details },
      });
    }
    if (err instanceof ZodError) {
      return reply.status(400).send({
        error: {
          code: 'INVALID_INPUT',
          message: 'Validation failed',
          details: { issues: err.flatten().fieldErrors },
        },
      });
    }
    app.log.error({ err }, 'unhandled error');
    return reply.status(500).send({
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
    });
  });
});
