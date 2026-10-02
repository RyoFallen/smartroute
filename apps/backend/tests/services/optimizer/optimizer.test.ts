import { describe, it, expect, vi } from 'vitest';
import type { OptimizeRequest } from '@smartroute/shared';
import { OptimizerService } from '../../../src/services/optimizer/index.js';
import type { FlightService } from '../../../src/services/flights/index.js';
import { keyOf } from '../../../src/services/flights/cache.js';
import type { PriceResult, PriceQuery } from '../../../src/services/flights/provider.js';
import { mulberry32 } from '../../../src/services/optimizer/ga.js';

// The exhaustive enumerator is a test oracle / benchmark baseline only. If the
// production optimize path ever touches it again, these tests must fail.
vi.mock('../../../src/services/optimizer/enumerate.js', () => ({
  enumerateOrderings: () => {
    throw new Error('enumerateOrderings must not be called on the API path');
  },
}));

function fakeFlights(map: Record<string, Partial<PriceResult>>): FlightService {
  return {
    getPrices: vi.fn(async (qs: PriceQuery[]) => {
      const prices = new Map<string, PriceResult>();
      for (const q of qs) {
        const base = map[`${q.origin}-${q.destination}`] ?? {
          priceCents: 50_000,
          durationMin: 300,
          stops: 0,
        };
        prices.set(keyOf(q), { ...q, carrier: 'X', ...base } as PriceResult);
      }
      return { prices, partial: false, staleCache: false };
    }),
  } as unknown as FlightService;
}

function baseReq(overrides: Partial<OptimizeRequest> = {}): OptimizeRequest {
  return {
    cities: ['JFK', 'CDG', 'FCO', 'MAD'],
    perCityDays: [2, 2, 2, 2],
    departDate: '2026-06-01',
    travelers: 1,
    cabinClass: 'ECONOMY',
    directOnly: false,
    preset: 'balanced',
    ...overrides,
  };
}

function service(map: Record<string, Partial<PriceResult>> = {}): OptimizerService {
  return new OptimizerService(fakeFlights(map), { rng: mulberry32(1) });
}

describe('OptimizerService', () => {
  it('leads with a recommended option followed by the deduped trio (1-4 options)', async () => {
    const res = await service().optimize(baseReq());
    expect(res.options.length).toBeGreaterThanOrEqual(1);
    expect(res.options.length).toBeLessThanOrEqual(4);
    expect(res.options[0]!.label).toBe('recommended');
    const keys = res.options.map((o) => o.order.join('>'));
    expect(new Set(keys).size).toBe(keys.length);
    const labels = res.options.map((o) => o.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('drops legs with stops when directOnly is true', async () => {
    const svc = service({
      'JFK-CDG': { priceCents: 50_000, durationMin: 300, stops: 1 },
      'CDG-JFK': { priceCents: 50_000, durationMin: 300, stops: 1 },
    });
    const res = await svc.optimize(
      baseReq({ cities: ['JFK', 'CDG'], perCityDays: [2, 2], directOnly: true }),
    );
    expect(res.options).toHaveLength(0);
    expect(res.reason).toMatch(/direct/i);
  });

  it('honors fixed start and end cities in every option', async () => {
    const res = await service().optimize(baseReq({ startCity: 'JFK', endCity: 'MAD' }));
    expect(res.options.length).toBeGreaterThanOrEqual(1);
    for (const o of res.options) {
      expect(o.order[0]).toBe('JFK');
      expect(o.order[o.order.length - 1]).toBe('MAD');
      expect([...o.order].sort()).toEqual([...baseReq().cities].sort());
    }
  });

  // #34. The first city in a visiting order is where the traveler flies out
  // from: it has no stay. Every later flight leaves after the stay of the city
  // it departs from. Pinned as a worked example rather than a re-derivation,
  // because the oracle in triples.test.ts once agreed with a wrong rule.
  describe('dates each flight by the stay of the city it leaves', () => {
    // Make JFK > CDG > FCO the only cheap way through, so every option's
    // first entry is that ordering and the dates are predictable.
    const cheapPath = {
      'JFK-CDG': { priceCents: 1_000, durationMin: 300, stops: 0 },
      'CDG-FCO': { priceCents: 1_000, durationMin: 300, stops: 0 },
    };
    const departures = (res: Awaited<ReturnType<OptimizerService['optimize']>>) =>
      res.options[0]!.flights.map((f) => `${f.origin}>${f.destination} ${f.depart.slice(0, 10)}`);

    it('gives the origin no stay when it is pinned as startCity', async () => {
      const res = await service(cheapPath).optimize(
        baseReq({ cities: ['JFK', 'CDG', 'FCO'], perCityDays: [0, 4, 2], startCity: 'JFK' }),
      );
      expect(res.options[0]!.order).toEqual(['JFK', 'CDG', 'FCO']);
      // Leave JFK on the departure date; leave CDG after its own four days.
      expect(departures(res)).toEqual(['JFK>CDG 2026-06-01', 'CDG>FCO 2026-06-05']);
    });

    it('ignores the stay of whichever city the optimizer puts first', async () => {
      const res = await service(cheapPath).optimize(
        baseReq({ cities: ['JFK', 'CDG', 'FCO'], perCityDays: [1, 4, 2] }),
      );
      expect(res.options[0]!.order).toEqual(['JFK', 'CDG', 'FCO']);
      // Not CDG>FCO on 06-02: that would hand CDG the origin's one day.
      expect(departures(res)).toEqual(['JFK>CDG 2026-06-01', 'CDG>FCO 2026-06-05']);
    });
  });
});
