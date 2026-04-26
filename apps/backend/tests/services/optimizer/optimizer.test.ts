import { describe, it, expect, vi } from 'vitest';
import { OptimizerService } from '../../../src/services/optimizer/index.js';
import type { FlightService } from '../../../src/services/flights/index.js';
import { keyOf } from '../../../src/services/flights/cache.js';
import type { PriceResult, PriceQuery } from '../../../src/services/flights/provider.js';

function fakeFlights(map: Record<string, Partial<PriceResult>>): FlightService {
  return {
    getPrices: vi.fn(async (qs: PriceQuery[]) => {
      const prices = new Map<string, PriceResult>();
      for (const q of qs) {
        const k = keyOf(q);
        const base = map[`${q.origin}-${q.destination}`] ?? { priceCents: 50_000, durationMin: 300, stops: 0 };
        prices.set(k, { ...q, carrier: 'X', ...base } as PriceResult);
      }
      return { prices, partial: false, staleCache: false };
    }),
  } as unknown as FlightService;
}

describe('OptimizerService', () => {
  it('returns up to 3 deduped labeled options', async () => {
    const svc = new OptimizerService(fakeFlights({}));
    const res = await svc.optimize({
      cities: ['JFK', 'CDG', 'FCO'],
      perCityDays: [2, 2, 2],
      departDate: '2026-06-01',
      travelers: 1,
      cabinClass: 'ECONOMY',
      directOnly: false,
    });
    expect(res.options.length).toBeGreaterThan(0);
    expect(res.options.length).toBeLessThanOrEqual(3);
    const labels = new Set(res.options.map((o) => o.label));
    expect(labels.size).toBe(res.options.length);
  });

  it('drops legs with stops when directOnly is true', async () => {
    const svc = new OptimizerService(
      fakeFlights({
        'JFK-CDG': { priceCents: 50_000, durationMin: 300, stops: 1 },
        'CDG-JFK': { priceCents: 50_000, durationMin: 300, stops: 1 },
      }),
    );
    const res = await svc.optimize({
      cities: ['JFK', 'CDG'],
      perCityDays: [2, 2],
      departDate: '2026-06-01',
      travelers: 1,
      cabinClass: 'ECONOMY',
      directOnly: true,
    });
    expect(res.options).toHaveLength(0);
    expect(res.reason).toMatch(/direct/i);
  });
});
