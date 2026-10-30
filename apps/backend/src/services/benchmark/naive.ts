import { haversineKm, type Coordinate } from '../itinerary/walking.js';
import type { BENCHMARK_CITIES, BenchmarkScenario } from './scenarios.js';

/**
 * Each curated city's coordinates, as `lat`/`lon` in `prisma/seed/attractions.json`.
 * Pinned for the same reason as `BENCHMARK_CITIES`: editing the seed data later
 * must not move a committed NaiveOrder. A seed-data test holds the two together.
 */
export const BENCHMARK_COORDINATES: Record<(typeof BENCHMARK_CITIES)[number], Coordinate> = {
  BCN: { lat: 41.3874, lon: 2.1686 },
  BER: { lat: 52.52, lon: 13.405 },
  BUD: { lat: 47.4979, lon: 19.0402 },
  CDG: { lat: 48.8566, lon: 2.3522 },
  FCO: { lat: 41.9028, lon: 12.4964 },
  IST: { lat: 41.0082, lon: 28.9784 },
  LHR: { lat: 51.5074, lon: -0.1278 },
  WAW: { lat: 52.2297, lon: 21.0122 },
};

/**
 * The NaiveOrder (#39): what a sensible traveler does with a map. From the
 * origin, fly to the nearest unvisited middle city by great-circle distance,
 * again and again; the pinned end city is always last. Distance ties go to the
 * lower IATA code.
 */
export function naiveOrder(
  s: BenchmarkScenario,
  coordinates: Record<string, Coordinate> = BENCHMARK_COORDINATES,
): string[] {
  const at = (city: string): Coordinate => {
    const c = coordinates[city];
    if (!c) throw new Error(`${city} has no benchmark coordinates`);
    return c;
  };
  const left = s.visited.map((v) => v.city).filter((c) => c !== s.endCity);
  const order = [s.origin];
  while (left.length > 0) {
    const here = at(order.at(-1)!);
    let best = 0;
    for (let i = 1; i < left.length; i++) {
      const d = haversineKm(here, at(left[i]!)) - haversineKm(here, at(left[best]!));
      if (d < 0 || (d === 0 && left[i]! < left[best]!)) best = i;
    }
    order.push(...left.splice(best, 1));
  }
  order.push(s.endCity);
  return order;
}
