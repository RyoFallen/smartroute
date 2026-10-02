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

  const legacyPayload = {
    cities: ['JFK', 'CDG', 'FCO'],
    perCityDays: [2, 2, 2],
    departDate: '2026-06-01',
    travelers: 1,
    cabinClass: 'ECONOMY',
    directOnly: false,
  };

  it('returns options on a presetless legacy request, leading with recommended', async () => {
    const app = await buildServer({ withDb: true });
    const res = await app.inject({
      method: 'POST',
      url: '/optimize',
      headers: { authorization: 'Bearer good', 'content-type': 'application/json' },
      payload: legacyPayload,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.options.length).toBeGreaterThan(0);
    expect(body.options[0].label).toBe('recommended');
  });

  // #34: the first city is where the traveler flies out from, so it has no
  // stay. Zero is allowed for the pinned startCity and for nothing else.
  it('accepts a zero stay for the startCity the traveler flies out from', async () => {
    const app = await buildServer({ withDb: true });
    const res = await app.inject({
      method: 'POST',
      url: '/optimize',
      headers: { authorization: 'Bearer good', 'content-type': 'application/json' },
      payload: { ...legacyPayload, startCity: 'JFK', perCityDays: [0, 2, 2] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().options[0].order[0]).toBe('JFK');
  });

  it('400s on a zero stay for any city other than the startCity', async () => {
    const app = await buildServer({ withDb: true });
    for (const payload of [
      { ...legacyPayload, perCityDays: [0, 2, 2] }, // no startCity at all
      { ...legacyPayload, startCity: 'JFK', perCityDays: [0, 0, 2] }, // a visited city
    ]) {
      const res = await app.inject({
        method: 'POST',
        url: '/optimize',
        headers: { authorization: 'Bearer good', 'content-type': 'application/json' },
        payload,
      });
      expect(res.statusCode).toBe(400);
    }
  });

  it('accepts an explicit preset', async () => {
    const app = await buildServer({ withDb: true });
    const res = await app.inject({
      method: 'POST',
      url: '/optimize',
      headers: { authorization: 'Bearer good', 'content-type': 'application/json' },
      payload: { ...legacyPayload, preset: 'budget' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().options[0].label).toBe('recommended');
  });

  it('400s on an unknown preset', async () => {
    const app = await buildServer({ withDb: true });
    const res = await app.inject({
      method: 'POST',
      url: '/optimize',
      headers: { authorization: 'Bearer good', 'content-type': 'application/json' },
      payload: { ...legacyPayload, preset: 'luxury' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('INVALID_INPUT');
  });
});
