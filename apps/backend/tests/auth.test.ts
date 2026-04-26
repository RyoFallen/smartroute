import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildServer } from '../src/server.js';

vi.mock('@clerk/backend', () => ({
  createClerkClient: () => ({
    authenticateRequest: vi.fn(async (req: Request) => {
      const auth = req.headers.get('authorization');
      if (auth === 'Bearer good') {
        return { isSignedIn: true, toAuth: () => ({ userId: 'user_123' }) };
      }
      return { isSignedIn: false, toAuth: () => null };
    }),
  }),
}));

describe('auth plugin', () => {
  beforeEach(() => {
    process.env.CLERK_SECRET_KEY = 'sk_test_x';
    process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_x';
  });

  it('rejects missing token with 401 UNAUTHORIZED', async () => {
    const app = await buildServer();
    app.get('/protected', { preHandler: [app.requireAuth] }, async (req) => ({ uid: req.userId }));
    const res = await app.inject({ method: 'GET', url: '/protected' });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
  });

  it('accepts valid bearer and exposes userId', async () => {
    const app = await buildServer();
    app.get('/protected', { preHandler: [app.requireAuth] }, async (req) => ({ uid: req.userId }));
    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: 'Bearer good' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ uid: 'user_123' });
  });
});
