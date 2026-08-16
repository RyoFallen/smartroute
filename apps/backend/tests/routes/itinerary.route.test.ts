import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
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

const ALICE = { authorization: 'Bearer u_alice', 'content-type': 'application/json' };

/**
 * IST → FCO → JFK. JFK is deliberately absent from the seed so the unavailable
 * city case is exercised; the IST departure is early enough that its last day
 * cannot hold anything.
 */
const trip = {
  name: 'Eurotrip',
  startDate: '2026-07-01',
  endDate: '2026-07-07',
  cabinClass: 'ECONOMY' as const,
  travelers: 1,
  cities: ['IST', 'FCO', 'JFK'],
  flights: [
    {
      origin: 'IST',
      destination: 'FCO',
      depart: '2026-07-03T09:00:00.000Z', // 12:00 in Istanbul
      arrive: '2026-07-03T11:00:00.000Z', // 13:00 in Rome
      carrier: 'XX',
      priceCents: 20_000,
      durationMin: 180,
      stops: 0,
    },
    {
      origin: 'FCO',
      destination: 'JFK',
      depart: '2026-07-05T14:00:00.000Z', // 16:00 in Rome
      arrive: '2026-07-05T22:00:00.000Z',
      carrier: 'XX',
      priceCents: 60_000,
      durationMin: 480,
      stops: 0,
    },
  ],
  totalPriceCents: 80_000,
};

function seedAttractions(count: number, lat: number, lon: number) {
  return Array.from({ length: count }, (_, i) => ({
    name: `Sight ${i + 1}`,
    category: 'LANDMARK' as const,
    rank: i + 1,
    lat: lat + i / 500,
    lon: lon + i / 500,
    description: 'A test attraction description.',
    tags: ['history'],
    visitMinutes: 60,
  }));
}

const seedFixture = [
  {
    iata: 'IST',
    altCodes: [],
    name: 'Istanbul',
    country: 'Türkiye',
    lat: 41.0082,
    lon: 28.9784,
    timezone: 'Europe/Istanbul',
    attractions: seedAttractions(12, 41.0, 28.98),
  },
  {
    iata: 'FCO',
    altCodes: [],
    name: 'Rome',
    country: 'Italy',
    lat: 41.9028,
    lon: 12.4964,
    timezone: 'Europe/Rome',
    attractions: seedAttractions(12, 41.9, 12.49),
  },
];

async function createTrip(app: FastifyInstance): Promise<string> {
  const res = await app.inject({ method: 'POST', url: '/trips', headers: ALICE, payload: trip });
  expect(res.statusCode).toBe(201);
  return res.json().id as string;
}

describe('GET /trips/:id/itinerary', () => {
  beforeEach(async () => {
    process.env.CLERK_SECRET_KEY = 'sk_test_x';
    process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_x';
    process.env.FLIGHT_PROVIDER = 'mock';
    process.env.WALKING_PROVIDER = 'mock';
    delete process.env.DUFFEL_API_KEY;
    await loadSeed(prisma, seedFixture);
  });

  it('requires auth', async () => {
    const app = await buildServer({ withDb: true });
    const res = await app.inject({ method: 'GET', url: '/trips/whatever/itinerary' });
    expect(res.statusCode).toBe(401);
  });

  it('reports another traveler trip as not found, not forbidden', async () => {
    const app = await buildServer({ withDb: true });
    const id = await createTrip(app);

    const res = await app.inject({
      method: 'GET',
      url: `/trips/${id}/itinerary`,
      headers: { authorization: 'Bearer u_bob' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns one city per stop, in visiting order', async () => {
    const app = await buildServer({ withDb: true });
    const id = await createTrip(app);

    const res = await app.inject({
      method: 'GET',
      url: `/trips/${id}/itinerary`,
      headers: ALICE,
    });
    expect(res.statusCode).toBe(200);
    const itinerary = res.json();
    expect(itinerary.tripId).toBe(id);
    expect(itinerary.cities.map((c: { iata: string }) => c.iata)).toEqual(['IST', 'FCO', 'JFK']);
  });

  it('groups each city stay into calendar days with timed VisitSlots', async () => {
    const app = await buildServer({ withDb: true });
    const id = await createTrip(app);

    const itinerary = (
      await app.inject({ method: 'GET', url: `/trips/${id}/itinerary`, headers: ALICE })
    ).json();

    const istanbul = itinerary.cities[0];
    expect(istanbul.available).toBe(true);
    expect(istanbul.days.map((d: { date: string }) => d.date)).toEqual([
      '2026-07-01',
      '2026-07-02',
      '2026-07-03',
    ]);
    expect(istanbul.days[0].dayOfStay).toBe(1);

    const slot = istanbul.days[0].slots[0];
    expect(slot).toMatchObject({
      name: 'Sight 1',
      category: 'LANDMARK',
      visitMinutes: 60,
      walkMinutesFromPrevious: null,
      hoursAssumed: true, // the fixture carries no OpeningHours
      closedOnThisDay: false,
    });
    expect(slot.startsAt).toBe('2026-07-01T09:00:00+03:00');
    expect(slot.endsAt).toBe('2026-07-01T10:00:00+03:00');
    expect(istanbul.days[0].slots[1].walkMinutesFromPrevious).toBeGreaterThan(0);
  });

  it('opens the arrival day after landing plus the transfer buffer, in the city timezone', async () => {
    const app = await buildServer({ withDb: true });
    const id = await createTrip(app);

    const itinerary = (
      await app.inject({ method: 'GET', url: `/trips/${id}/itinerary`, headers: ALICE })
    ).json();

    const rome = itinerary.cities[1];
    expect(rome.days.map((d: { date: string }) => d.date)).toEqual([
      '2026-07-03',
      '2026-07-04',
      '2026-07-05',
    ]);
    // Lands 13:00 local, plus the 90-minute transfer buffer.
    expect(rome.days[0].slots[0].startsAt).toBe('2026-07-03T14:30:00+02:00');
  });

  it('leaves an unschedulable departure day empty, with its reason', async () => {
    const app = await buildServer({ withDb: true });
    const id = await createTrip(app);

    const itinerary = (
      await app.inject({ method: 'GET', url: `/trips/${id}/itinerary`, headers: ALICE })
    ).json();

    // Departs 12:00 local; minus the 180-minute airport buffer the day is over
    // at 09:00, which is when it would have opened.
    expect(itinerary.cities[0].days[2]).toMatchObject({
      empty: true,
      emptyReason: 'DEPARTURE_TOO_EARLY',
      slots: [],
    });
  });

  it('reports a city with no attraction data as unavailable', async () => {
    const app = await buildServer({ withDb: true });
    const id = await createTrip(app);

    const itinerary = (
      await app.inject({ method: 'GET', url: `/trips/${id}/itinerary`, headers: ALICE })
    ).json();

    expect(itinerary.cities[2]).toEqual({
      iata: 'JFK',
      name: null,
      available: false,
      days: [],
    });
  });

  it('never schedules the same attraction twice within a city', async () => {
    const app = await buildServer({ withDb: true });
    const id = await createTrip(app);

    const itinerary = (
      await app.inject({ method: 'GET', url: `/trips/${id}/itinerary`, headers: ALICE })
    ).json();

    for (const city of itinerary.cities) {
      const ids = city.days.flatMap((d: { slots: { attractionId: string }[] }) =>
        d.slots.map((s) => s.attractionId),
      );
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('starts the day at the traveler stored wake-up time', async () => {
    const app = await buildServer({ withDb: true });
    const saved = await app.inject({
      method: 'PUT',
      url: '/users/me',
      headers: ALICE,
      payload: { intensity: 'MODERATE', wakeUpTime: '07:30' },
    });
    expect(saved.statusCode).toBe(200);
    const id = await createTrip(app);

    const itinerary = (
      await app.inject({ method: 'GET', url: `/trips/${id}/itinerary`, headers: ALICE })
    ).json();

    expect(itinerary.cities[0].days[0].slots[0].startsAt).toBe('2026-07-01T07:30:00+03:00');
  });

  it('leaves the flat must-go plan endpoint working', async () => {
    const app = await buildServer({ withDb: true });
    const id = await createTrip(app);

    const res = await app.inject({ method: 'GET', url: `/trips/${id}/plan`, headers: ALICE });
    expect(res.statusCode).toBe(200);
    expect(res.json().cities[0].mustGo).toHaveLength(12);
  });
});
