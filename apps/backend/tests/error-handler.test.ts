import { describe, it, expect } from 'vitest';
import { buildServer } from '../src/server.js';
import { ApiError } from '../src/lib/ApiError.js';

describe('error handler', () => {
  it('maps ApiError to envelope with proper status', async () => {
    const app = await buildServer();
    app.get('/boom', async () => {
      throw new ApiError('NOT_FOUND', 'gone', 404);
    });
    const res = await app.inject({ method: 'GET', url: '/boom' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({
      error: { code: 'NOT_FOUND', message: 'gone' },
    });
  });

  it('maps ZodError to INVALID_INPUT 400', async () => {
    const app = await buildServer();
    const { z } = await import('zod');
    app.get('/zod', async () => {
      z.object({ x: z.string() }).parse({});
    });
    const res = await app.inject({ method: 'GET', url: '/zod' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('INVALID_INPUT');
  });

  it('maps unknown errors to INTERNAL_ERROR 500', async () => {
    const app = await buildServer();
    app.get('/unknown', async () => {
      throw new Error('kaboom');
    });
    const res = await app.inject({ method: 'GET', url: '/unknown' });
    expect(res.statusCode).toBe(500);
    expect(res.json().error.code).toBe('INTERNAL_ERROR');
  });
});
