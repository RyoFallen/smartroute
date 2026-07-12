import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildServer } from '../../src/server.js';
import { InterestCategory } from '@smartroute/shared';

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

const alice = { authorization: 'Bearer u_alice', 'content-type': 'application/json' };
const bob = { authorization: 'Bearer u_bob', 'content-type': 'application/json' };

const allNeutral = InterestCategory.options.map((category) => ({ category, rating: 0 }));

describe('/users/me', () => {
  beforeEach(() => {
    process.env.CLERK_SECRET_KEY = 'sk_test_x';
    process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_x';
  });

  it('returns { profile: null } before the first write', async () => {
    const app = await buildServer({ withDb: true });
    const res = await app.inject({ method: 'GET', url: '/users/me', headers: alice });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ profile: null });
  });

  it('requires auth', async () => {
    const app = await buildServer({ withDb: true });
    const res = await app.inject({ method: 'GET', url: '/users/me' });
    expect(res.statusCode).toBe(401);
  });

  it('upserts preferences: create then update', async () => {
    const app = await buildServer({ withDb: true });

    const create = await app.inject({
      method: 'PUT',
      url: '/users/me',
      headers: alice,
      payload: { intensity: 'PACKED', wakeUpTime: '07:30' },
    });
    expect(create.statusCode).toBe(200);
    expect(create.json().profile).toMatchObject({ intensity: 'PACKED', wakeUpTime: '07:30' });

    const update = await app.inject({
      method: 'PUT',
      url: '/users/me',
      headers: alice,
      payload: { intensity: 'RELAXED', wakeUpTime: '10:00' },
    });
    expect(update.statusCode).toBe(200);

    const get = await app.inject({ method: 'GET', url: '/users/me', headers: alice });
    expect(get.json().profile).toMatchObject({
      intensity: 'RELAXED',
      wakeUpTime: '10:00',
      interests: [],
    });
  });

  it('rejects invalid intensity and wake-up time', async () => {
    const app = await buildServer({ withDb: true });

    const badIntensity = await app.inject({
      method: 'PUT',
      url: '/users/me',
      headers: alice,
      payload: { intensity: 'FRANTIC', wakeUpTime: '09:00' },
    });
    expect(badIntensity.statusCode).toBe(400);

    const badTime = await app.inject({
      method: 'PUT',
      url: '/users/me',
      headers: alice,
      payload: { intensity: 'MODERATE', wakeUpTime: '25:99' },
    });
    expect(badTime.statusCode).toBe(400);
  });

  it('replaces the full interest set idempotently and creates the profile row if absent', async () => {
    const app = await buildServer({ withDb: true });

    const first = await app.inject({
      method: 'PUT',
      url: '/users/me/interests',
      headers: alice,
      payload: { interests: allNeutral },
    });
    expect(first.statusCode).toBe(200);

    // profile row was created with defaults
    const afterFirst = await app.inject({ method: 'GET', url: '/users/me', headers: alice });
    expect(afterFirst.json().profile).toMatchObject({ intensity: 'MODERATE', wakeUpTime: '09:00' });
    expect(afterFirst.json().profile.interests).toHaveLength(15);

    // second write fully replaces the previous set
    const second = await app.inject({
      method: 'PUT',
      url: '/users/me/interests',
      headers: alice,
      payload: {
        interests: [
          { category: 'museums-galleries', rating: 1 },
          { category: 'nightlife-bars', rating: -1 },
        ],
      },
    });
    expect(second.statusCode).toBe(200);

    const afterSecond = await app.inject({ method: 'GET', url: '/users/me', headers: alice });
    expect(afterSecond.json().profile.interests).toEqual([
      { category: 'museums-galleries', rating: 1 },
      { category: 'nightlife-bars', rating: -1 },
    ]);
  });

  it('rejects unknown slugs, out-of-range ratings, and duplicate categories', async () => {
    const app = await buildServer({ withDb: true });

    const unknownSlug = await app.inject({
      method: 'PUT',
      url: '/users/me/interests',
      headers: alice,
      payload: { interests: [{ category: 'space-tourism', rating: 1 }] },
    });
    expect(unknownSlug.statusCode).toBe(400);

    const badRating = await app.inject({
      method: 'PUT',
      url: '/users/me/interests',
      headers: alice,
      payload: { interests: [{ category: 'shopping', rating: 2 }] },
    });
    expect(badRating.statusCode).toBe(400);

    const duplicate = await app.inject({
      method: 'PUT',
      url: '/users/me/interests',
      headers: alice,
      payload: {
        interests: [
          { category: 'shopping', rating: 1 },
          { category: 'shopping', rating: -1 },
        ],
      },
    });
    expect(duplicate.statusCode).toBe(400);
  });

  it('isolates users: writes under one token never appear under another', async () => {
    const app = await buildServer({ withDb: true });

    await app.inject({
      method: 'PUT',
      url: '/users/me',
      headers: alice,
      payload: { intensity: 'PACKED', wakeUpTime: '06:00' },
    });

    const bobGet = await app.inject({ method: 'GET', url: '/users/me', headers: bob });
    expect(bobGet.json()).toEqual({ profile: null });
  });
});
