import { describe, it, expect } from 'vitest';
import { PriceCache } from '../../../src/services/flights/cache.js';
import { prisma } from '../../setup-db.js';

const Q = { origin: 'JFK', destination: 'CDG', departDate: '2026-06-01', cabinClass: 'ECONOMY' as const };

describe('PriceCache', () => {
  it('returns empty when nothing is cached', async () => {
    const cache = new PriceCache(prisma);
    const hits = await cache.lookup([Q]);
    expect(hits.size).toBe(0);
  });

  it('stores and retrieves a price', async () => {
    const cache = new PriceCache(prisma);
    await cache.upsert([
      { ...Q, priceCents: 50_000, durationMin: 420, stops: 0, carrier: 'AF' },
    ]);
    const hits = await cache.lookup([Q]);
    expect(hits.size).toBe(1);
    const v = hits.get(`${Q.origin}|${Q.destination}|${Q.departDate}|${Q.cabinClass}`);
    expect(v?.priceCents).toBe(50_000);
  });

  it('reports stale entries via maxAgeMs', async () => {
    const cache = new PriceCache(prisma);
    await cache.upsert([
      { ...Q, priceCents: 50_000, durationMin: 420, stops: 0, carrier: 'AF' },
    ]);
    await new Promise((r) => setTimeout(r, 50));
    const fresh = await cache.lookup([Q], { maxAgeMs: 10 });
    const all = await cache.lookup([Q]);
    expect(fresh.size).toBe(0);
    expect(all.size).toBe(1);
  });
});
