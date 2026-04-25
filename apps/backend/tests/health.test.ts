import { describe, it, expect, afterEach } from 'vitest';
import { buildServer } from '../src/server.js';

describe('GET /health', () => {
  let server: Awaited<ReturnType<typeof buildServer>>;

  afterEach(async () => {
    if (server) await server.close();
  });

  it('returns 200 with status ok', async () => {
    server = await buildServer();
    const res = await server.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });
});
