import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildServer } from '../../src/server.js';
import { prisma } from '../setup-db.js';

const deleteUser = vi.hoisted(() => vi.fn());

vi.mock('@clerk/backend', () => ({
  createClerkClient: () => ({
    authenticateRequest: vi.fn(async (req: Request) => {
      const auth = req.headers.get('authorization');
      if (auth?.startsWith('Bearer u_')) {
        return { isSignedIn: true, toAuth: () => ({ userId: auth.slice(7) }) };
      }
      return { isSignedIn: false, toAuth: () => null };
    }),
    users: { deleteUser },
  }),
}));

const alice = { authorization: 'Bearer u_alice', 'content-type': 'application/json' };

const tripBody = {
  name: 'Eurotrip',
  startDate: '2026-06-01',
  endDate: '2026-06-08',
  cabinClass: 'ECONOMY',
  travelers: 1,
  cities: ['JFK', 'CDG'],
  flights: [],
  totalPriceCents: 0,
};

async function seedAccount(app: Awaited<ReturnType<typeof buildServer>>, headers: typeof alice) {
  await app.inject({
    method: 'PUT',
    url: '/users/me',
    headers,
    payload: { intensity: 'PACKED', wakeUpTime: '07:00' },
  });
  await app.inject({
    method: 'PUT',
    url: '/users/me/interests',
    headers,
    payload: { interests: [{ category: 'shopping', rating: 1 }] },
  });
  await app.inject({ method: 'POST', url: '/trips', headers, payload: tripBody });
}

describe('DELETE /users/me', () => {
  beforeEach(() => {
    process.env.CLERK_SECRET_KEY = 'sk_test_x';
    process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_x';
    deleteUser.mockReset();
    deleteUser.mockResolvedValue(undefined);
  });

  it('erases profile, interests, and trips for the caller only, then deletes the Clerk user', async () => {
    const app = await buildServer({ withDb: true });
    const bob = { authorization: 'Bearer u_bob', 'content-type': 'application/json' };
    await seedAccount(app, alice);
    await seedAccount(app, bob);

    const res = await app.inject({ method: 'DELETE', url: '/users/me', headers: alice });
    expect(res.statusCode).toBe(204);
    expect(deleteUser).toHaveBeenCalledTimes(1);
    expect(deleteUser).toHaveBeenCalledWith('u_alice');

    // alice's data is gone from every store
    expect(await prisma.userProfile.findUnique({ where: { userId: 'u_alice' } })).toBeNull();
    expect(await prisma.interest.count({ where: { userId: 'u_alice' } })).toBe(0);
    expect(await prisma.trip.count({ where: { userId: 'u_alice' } })).toBe(0);

    // bob's is untouched
    expect(await prisma.userProfile.findUnique({ where: { userId: 'u_bob' } })).not.toBeNull();
    expect(await prisma.interest.count({ where: { userId: 'u_bob' } })).toBe(1);
    expect(await prisma.trip.count({ where: { userId: 'u_bob' } })).toBe(1);
  });

  it('never calls Clerk for an unauthenticated request', async () => {
    const app = await buildServer({ withDb: true });
    const res = await app.inject({ method: 'DELETE', url: '/users/me' });
    expect(res.statusCode).toBe(401);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('surfaces a Clerk failure and succeeds on retry', async () => {
    const app = await buildServer({ withDb: true });
    await seedAccount(app, alice);
    deleteUser.mockRejectedValueOnce(new Error('clerk down'));

    const first = await app.inject({ method: 'DELETE', url: '/users/me', headers: alice });
    expect(first.statusCode).toBe(500);

    const retry = await app.inject({ method: 'DELETE', url: '/users/me', headers: alice });
    expect(retry.statusCode).toBe(204);
    expect(deleteUser).toHaveBeenCalledTimes(2);
  });
});
