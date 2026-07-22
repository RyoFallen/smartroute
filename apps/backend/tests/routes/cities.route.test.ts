import { describe, it, expect, vi } from 'vitest';
import { buildServer } from '../../src/server.js';
import { prisma } from '../setup-db.js';

vi.mock('@clerk/backend', () => ({
  createClerkClient: () => ({
    authenticateRequest: vi.fn(async (req: Request) => {
      const auth = req.headers.get('authorization');
      if (auth?.startsWith('Bearer u_')) {
        return { isSignedIn: true, toAuth: () => ({ userId: auth.slice(7) }) };
      }
      return { isSignedIn: false, toAuth: () => null };
    }),
  }),
}));

const alice = { authorization: 'Bearer u_alice' };

function city(iata: string, name: string, country: string) {
  return { iata, name, country, altCodes: [], lat: 0, lon: 0, timezone: 'UTC' };
}

describe('GET /cities', () => {
  it('requires auth', async () => {
    const app = await buildServer({ withDb: true });
    const res = await app.inject({ method: 'GET', url: '/cities' });
    expect(res.statusCode).toBe(401);
  });

  it('returns curated cities sorted by name', async () => {
    await prisma.city.createMany({
      data: [
        city('IST', 'Istanbul', 'Türkiye'),
        city('BCN', 'Barcelona', 'Spain'),
        city('WAW', 'Warsaw', 'Poland'),
      ],
    });

    const app = await buildServer({ withDb: true });
    const res = await app.inject({ method: 'GET', url: '/cities', headers: alice });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([
      { iata: 'BCN', name: 'Barcelona', country: 'Spain' },
      { iata: 'IST', name: 'Istanbul', country: 'Türkiye' },
      { iata: 'WAW', name: 'Warsaw', country: 'Poland' },
    ]);
  });
});
