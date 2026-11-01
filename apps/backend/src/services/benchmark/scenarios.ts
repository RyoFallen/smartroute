import { z } from 'zod';
import { mulberry32 } from '../optimizer/ga.js';
import type { TripleInput } from '../optimizer/triples.js';

/**
 * The 8 curated cities, by the IATA code that stands for each city's benchmark
 * airport list (ADR-0006). Pinned here rather than read from `attractions.json`
 * so that adding a curated city later cannot change what a committed seed
 * draws; a seed-data test holds this list to the seed file.
 */
export const BENCHMARK_CITIES = ['BCN', 'BER', 'BUD', 'CDG', 'FCO', 'IST', 'LHR', 'WAW'] as const;

/** 5 scenarios at each size of origin + 4, 5, 6 and 7 visited cities (#35). */
const SCENARIO_SIZES = [4, 5, 6, 7] as const;
const SCENARIOS_PER_SIZE = 5;
const MIN_STAY_DAYS = 2;
const MAX_STAY_DAYS = 4;
/**
 * Every flight of every scenario — the first and the last alike — falls in this
 * window, 2–8 weeks out from all three CaptureSessions (1 Nov, 7 Nov, 14 Nov
 * 2026: 28 Nov is 2 weeks after the last, 22 Dec under 8 weeks after the first).
 * It is 25 days, and the longest flown span (six 4-day stays before the end
 * city) is 24, so every scenario has at least one departure date that fits.
 */
const FIRST_FLIGHT = '2026-11-28';
const LAST_FLIGHT = '2026-12-22';

export const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const BenchmarkScenario = z.object({
  id: z.string(),
  /** Where the traveler flies out from; it carries no stay. */
  origin: z.string(),
  /** The visited cities, by IATA, each with its CityStay. Includes `endCity`. */
  visited: z.array(z.object({ city: z.string(), stayDays: z.number().int() })),
  /** The pinned last city, one of `visited`. */
  endCity: z.string(),
  departDate: IsoDate,
});
export type BenchmarkScenario = z.infer<typeof BenchmarkScenario>;

export const ScenarioFile = z.object({
  seed: z.number().int(),
  scenarios: z.array(BenchmarkScenario),
});
export type ScenarioFile = z.infer<typeof ScenarioFile>;

const DAY_MS = 86_400_000;

/**
 * The 20 BenchmarkScenarios a seed draws. Nobody chooses the trips: the same
 * seed always gives the same scenarios, so an examiner can regenerate them.
 *
 * Every draw comes from one `mulberry32` stream in a fixed order (sizes
 * ascending; within a scenario origin, visited cities, end city, stays, date),
 * so changing that order changes what a committed seed means.
 */
export function drawScenarios(seed: number): BenchmarkScenario[] {
  const rng = mulberry32(seed);
  const randomInt = (n: number): number => Math.floor(rng() * n);
  const firstMs = Date.parse(FIRST_FLIGHT);
  const windowDays = (Date.parse(LAST_FLIGHT) - firstMs) / DAY_MS + 1;

  const out: BenchmarkScenario[] = [];
  for (const size of SCENARIO_SIZES) {
    for (let k = 0; k < SCENARIOS_PER_SIZE; k++) {
      const origin = BENCHMARK_CITIES[randomInt(BENCHMARK_CITIES.length)]!;
      const pool = BENCHMARK_CITIES.filter((c) => c !== origin);
      // Partial Fisher–Yates: the first `size` slots are a uniform draw.
      for (let i = 0; i < size; i++) {
        const j = i + randomInt(pool.length - i);
        [pool[i], pool[j]] = [pool[j]!, pool[i]!];
      }
      const cities = pool.slice(0, size).sort();
      const endCity = cities[randomInt(cities.length)]!;
      const visited = cities.map((city) => ({
        city,
        stayDays: MIN_STAY_DAYS + randomInt(MAX_STAY_DAYS - MIN_STAY_DAYS + 1),
      }));
      // The last flight leaves after every visited city's stay but the end
      // city's, so the departure is drawn uniformly from the days that still
      // land it inside the window.
      const flownDays = visited
        .filter((v) => v.city !== endCity)
        .reduce((n, v) => n + v.stayDays, 0);
      const departDate = new Date(firstMs + randomInt(windowDays - flownDays) * DAY_MS)
        .toISOString()
        .slice(0, 10);
      out.push({
        id: `S${String(out.length + 1).padStart(2, '0')}`,
        origin,
        visited,
        endCity,
        departDate,
      });
    }
  }
  return out;
}

/**
 * A scenario as the optimizer sees it: the origin is the pinned first city with
 * a stay of 0 (the fly-out-from rule, #34), the end city is pinned last, and
 * only the cities between them are ordered.
 */
export function optimizerInput(s: BenchmarkScenario): TripleInput {
  return {
    cities: [s.origin, ...s.visited.map((v) => v.city)],
    perCityDays: [0, ...s.visited.map((v) => v.stayDays)],
    startCity: s.origin,
    endCity: s.endCity,
    departDate: s.departDate,
    cabinClass: 'ECONOMY',
  };
}
