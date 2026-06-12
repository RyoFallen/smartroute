import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildServer } from '../../src/server.js';

vi.mock('@clerk/backend', () => ({
  createClerkClient: () => ({
    authenticateRequest: vi.fn(async (req: Request) => {
      if (req.headers.get('authorization') === 'Bearer good') {
        return { isSignedIn: true, toAuth: () => ({ userId: 'u1' }) };
      }
      return { isSignedIn: false, toAuth: () => null };
    }),
  }),
}));

describe('POST /optimize', () => {
  beforeEach(() => {
    process.env.CLERK_SECRET_KEY = 'sk_test_x';
    process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_x';
    process.env.FLIGHT_PROVIDER = 'mock';
    delete process.env.DUFFEL_API_KEY;
  });

  it('rejects unauth', async () => {
    const app = await buildServer({ withDb: true });
    const res = await app.inject({ method: 'POST', url: '/optimize', payload: {} });
    expect(res.statusCode).toBe(401);
  });

  it('400s on invalid input', async () => {
    const app = await buildServer({ withDb: true });
    const res = await app.inject({
      method: 'POST',
      url: '/optimize',
      headers: { authorization: 'Bearer good', 'content-type': 'application/json' },
      payload: { cities: ['JFK'] },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('INVALID_INPUT');
  });

  it('returns options on valid input', async () => {
    const app = await buildServer({ withDb: true });
    const res = await app.inject({
      method: 'POST',
      url: '/optimize',
      headers: { authorization: 'Bearer good', 'content-type': 'application/json' },
      payload: {
        cities: ['JFK', 'CDG', 'FCO'],
        perCityDays: [2, 2, 2],
        departDate: '2026-06-01',
        travelers: 1,
        cabinClass: 'ECONOMY',
        directOnly: false,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().options.length).toBeGreaterThan(0);
  });
});
