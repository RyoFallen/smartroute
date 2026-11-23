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

function city(iata: string, name: string, country: string, lat = 0, lon = 0) {
  return { iata, name, country, altCodes: [], lat, lon, timezone: 'UTC' };
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
        city('IST', 'Istanbul', 'Türkiye', 41.0082, 28.9784),
        city('BCN', 'Barcelona', 'Spain', 41.3874, 2.1686),
        city('WAW', 'Warsaw', 'Poland', 52.2297, 21.0122),
      ],
    });

    const app = await buildServer({ withDb: true });
    const res = await app.inject({ method: 'GET', url: '/cities', headers: alice });

    expect(res.statusCode).toBe(200);
    const items = res.json() as { iata: string; name: string; lat: number; lon: number }[];
    expect(items.map((c) => c.name)).toEqual(['Barcelona', 'Istanbul', 'Warsaw']);
    for (const c of items) {
      expect(typeof c.lat).toBe('number');
      expect(typeof c.lon).toBe('number');
    }
    const ist = items.find((c) => c.iata === 'IST')!;
    expect(ist.lat).toBeGreaterThan(40.9);
    expect(ist.lat).toBeLessThan(41.1);
    expect(ist.lon).toBeGreaterThan(28.9);
    expect(ist.lon).toBeLessThan(29.1);
  });
});
