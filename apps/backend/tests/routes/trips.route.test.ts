import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildServer } from '../../src/server.js';

vi.mock('@clerk/backend', () => ({
  createClerkClient: () => ({
    authenticateRequest: vi.fn(async (req: Request) => {
      const auth = req.headers.get('authorization');
      if (auth?.startsWith('Bearer u_')) {
        return { isAuthenticated: true, toAuth: () => ({ userId: auth.slice(7) }) };
      }
      return { isAuthenticated: false, toAuth: () => null };
    }),
  }),
}));

const body = {
  name: 'Eurotrip',
  startDate: '2026-06-01',
  endDate: '2026-06-08',
  cabinClass: 'ECONOMY',
  travelers: 1,
  cities: ['JFK', 'CDG', 'FCO'],
  flights: [
    { origin: 'JFK', destination: 'CDG', depart: '2026-06-01T08:00:00.000Z', arrive: '2026-06-01T14:00:00.000Z', carrier: 'AF', priceCents: 50000, durationMin: 360, stops: 0 },
  ],
  totalPriceCents: 50000,
};

describe('/trips', () => {
  beforeEach(() => {
    process.env.CLERK_SECRET_KEY = 'sk_test_x';
    process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_x';
  });

  it('full CRUD lifecycle', async () => {
    const app = await buildServer({ withDb: true });
    const auth = { authorization: 'Bearer u_alice', 'content-type': 'application/json' };

    const create = await app.inject({ method: 'POST', url: '/trips', headers: auth, payload: body });
    expect(create.statusCode).toBe(201);
    const id = create.json().id;

    const list = await app.inject({ method: 'GET', url: '/trips', headers: auth });
    expect(list.json()).toHaveLength(1);

    const get = await app.inject({ method: 'GET', url: `/trips/${id}`, headers: auth });
    expect(get.statusCode).toBe(200);

    const otherAuth = { authorization: 'Bearer u_bob' };
    const cross = await app.inject({ method: 'GET', url: `/trips/${id}`, headers: otherAuth });
    expect(cross.statusCode).toBe(404);

    const del = await app.inject({ method: 'DELETE', url: `/trips/${id}`, headers: auth });
    expect(del.statusCode).toBe(204);
  });
});
