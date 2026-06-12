import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildServer } from '../../src/server.js';
import { loadSeed } from '../../prisma/seed.js';
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

const body = {
  name: 'Eurotrip',
  startDate: '2026-07-01',
  endDate: '2026-07-08',
  cabinClass: 'ECONOMY',
  travelers: 1,
  cities: ['IST', 'JFK'],
  flights: [
    {
      origin: 'IST',
      destination: 'JFK',
      depart: '2026-07-01T08:00:00.000Z',
      arrive: '2026-07-01T19:00:00.000Z',
      carrier: 'XX',
      priceCents: 50_000,
      durationMin: 660,
      stops: 0,
    },
  ],
  totalPriceCents: 50_000,
};

const seedFixture = [
  {
    iata: 'IST',
    altCodes: [],
    name: 'Istanbul',
    country: 'Türkiye',
    lat: 41.0082,
    lon: 28.9784,
    timezone: 'Europe/Istanbul',
    attractions: Array.from({ length: 8 }, (_, i) => ({
      name: `Sight ${i + 1}`,
      category: 'LANDMARK' as const,
      rank: i + 1,
      lat: 41.0,
      lon: 28.98,
      description: 'A test attraction description.',
      tags: ['history'],
    })),
  },
];

describe('GET /trips/:id/plan', () => {
  beforeEach(async () => {
    process.env.CLERK_SECRET_KEY = 'sk_test_x';
    process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_x';
    process.env.FLIGHT_PROVIDER = 'mock';
    delete process.env.DUFFEL_API_KEY;
    await loadSeed(prisma, seedFixture);
  });

  it('requires auth', async () => {
    const app = await buildServer({ withDb: true });
    const res = await app.inject({ method: 'GET', url: '/trips/whatever/plan' });
    expect(res.statusCode).toBe(401);
  });

  it('returns the plan for an owned trip', async () => {
    const app = await buildServer({ withDb: true });
    const auth = { authorization: 'Bearer u_alice', 'content-type': 'application/json' };

    const create = await app.inject({
      method: 'POST',
      url: '/trips',
      headers: auth,
      payload: body,
    });
    expect(create.statusCode).toBe(201);
    const id = create.json().id;

    const res = await app.inject({ method: 'GET', url: `/trips/${id}/plan`, headers: auth });
    expect(res.statusCode).toBe(200);
    const plan = res.json();
    expect(plan.tripId).toBe(id);
    expect(plan.cities).toHaveLength(2);
    expect(plan.cities[0]).toMatchObject({ iata: 'IST', available: true });
    expect(plan.cities[0].mustGo).toHaveLength(8);
    expect(plan.cities[1]).toMatchObject({ iata: 'JFK', available: false, mustGo: [] });
  });

  it('404s for another user trip', async () => {
    const app = await buildServer({ withDb: true });
    const create = await app.inject({
      method: 'POST',
      url: '/trips',
      headers: { authorization: 'Bearer u_alice', 'content-type': 'application/json' },
      payload: body,
    });
    const id = create.json().id;
    const res = await app.inject({
      method: 'GET',
      url: `/trips/${id}/plan`,
      headers: { authorization: 'Bearer u_bob' },
    });
    expect(res.statusCode).toBe(404);
  });
});
