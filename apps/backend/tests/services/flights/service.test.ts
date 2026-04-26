import { describe, it, expect, vi } from 'vitest';
import { FlightService } from '../../../src/services/flights/index.js';
import { PriceCache, keyOf } from '../../../src/services/flights/cache.js';
import type {
  FlightProvider,
  PriceQuery,
  PriceResult,
} from '../../../src/services/flights/provider.js';
import { prisma } from '../../setup-db.js';

const Q1: PriceQuery = {
  origin: 'JFK',
  destination: 'CDG',
  departDate: '2026-06-01',
  cabinClass: 'ECONOMY',
};
const Q2: PriceQuery = {
  origin: 'CDG',
  destination: 'FCO',
  departDate: '2026-06-04',
  cabinClass: 'ECONOMY',
};
const r = (q: PriceQuery, p: number): PriceResult => ({
  ...q,
  priceCents: p,
  durationMin: 300,
  stops: 0,
  carrier: 'AF',
});

class FakeProvider implements FlightProvider {
  constructor(private readonly results: PriceResult[]) {}
  getPrices = vi.fn(async (qs: PriceQuery[]) =>
    qs.map((q) => this.results.find((x) => keyOf(x) === keyOf(q))!),
  );
}

describe('FlightService', () => {
  it('serves all from cache when fresh', async () => {
    const cache = new PriceCache(prisma);
    await cache.upsert([r(Q1, 50_000)]);
    const provider = new FakeProvider([]);
    const svc = new FlightService(cache, provider);
    const out = await svc.getPrices([Q1]);
    expect(provider.getPrices).not.toHaveBeenCalled();
    expect(out.prices.size).toBe(1);
    expect(out.partial).toBe(false);
    expect(out.staleCache).toBe(false);
  });

  it('fetches missing pairs and caches them', async () => {
    const cache = new PriceCache(prisma);
    await cache.upsert([r(Q1, 50_000)]);
    const provider = new FakeProvider([r(Q2, 30_000)]);
    const svc = new FlightService(cache, provider);
    const out = await svc.getPrices([Q1, Q2]);
    expect(provider.getPrices).toHaveBeenCalledOnce();
    expect(provider.getPrices).toHaveBeenCalledWith([Q2]);
    expect(out.prices.size).toBe(2);
    const reHit = await cache.lookup([Q2]);
    expect(reHit.size).toBe(1);
  });

  it('falls back to stale cache when provider throws', async () => {
    const cache = new PriceCache(prisma);
    await cache.upsert([r(Q1, 50_000)]);
    await new Promise((r) => setTimeout(r, 30));
    const provider: FlightProvider = {
      getPrices: vi.fn(async () => {
        throw new Error('vendor down');
      }),
    };
    const svc = new FlightService(cache, provider, { freshMs: 10 });
    const out = await svc.getPrices([Q1]);
    expect(out.prices.size).toBe(1);
    expect(out.staleCache).toBe(true);
  });
});
