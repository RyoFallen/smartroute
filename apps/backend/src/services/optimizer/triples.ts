import type { CabinClass } from '@smartroute/shared';
import type { PriceQuery } from '../flights/provider.js';

export interface TripleInput {
  cities: string[];
  startCity?: string | undefined;
  endCity?: string | undefined;
  perCityDays: number[];
  departDate: string;
  cabinClass: CabinClass;
}

/**
 * Every (origin, destination, departDate) a constrained ordering can produce,
 * without enumerating permutations.
 *
 * The first city in an ordering is where the traveler flies out from and has
 * no stay (#34). So a leg o->d leaves on `departDate` when o is first, and
 * otherwise after o's own stay plus the stays of the cities visited between
 * the first city and o. The possible dates for a pair are therefore o's stay
 * plus the subset sums of the other cities' stays, for every city that could
 * be first — constrained by the fixed start (always first) and fixed end
 * (never before o unless it is d, in which case everything else is).
 */
export function collectPriceTriples(input: TripleInput): PriceQuery[] {
  const { cities, startCity, endCity, perCityDays, departDate, cabinClass } = input;
  const stayOf = new Map(cities.map((c, i) => [c, perCityDays[i] ?? 1]));
  const baseMs = new Date(departDate).getTime();

  const seen = new Set<string>();
  const out: PriceQuery[] = [];
  const add = (origin: string, destination: string, offsetDays: number): void => {
    const date = new Date(baseMs + offsetDays * 86_400_000).toISOString().slice(0, 10);
    const key = `${origin}|${destination}|${date}|${cabinClass}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ origin, destination, departDate: date, cabinClass });
  };

  for (const o of cities) {
    if (endCity && o === endCity) continue;
    const ownStay = stayOf.get(o)!;
    for (const d of cities) {
      if (d === o) continue;
      if (startCity && d === startCity) continue;
      const rest = cities.filter((c) => c !== o && c !== d);
      const canBeFirst = !startCity || o === startCity;

      if (endCity && d === endCity) {
        // d is last, so every other city precedes o.
        if (rest.length === 0) {
          if (canBeFirst) add(o, d, 0);
          continue;
        }
        if (startCity === o) continue; // the start cannot have anything before it
        for (const first of startCity ? [startCity] : rest) {
          add(o, d, ownStay + sum(rest.filter((c) => c !== first).map((c) => stayOf.get(c)!)));
        }
        continue;
      }

      if (canBeFirst) add(o, d, 0);
      if (startCity === o) continue;
      const firsts = startCity ? [startCity] : rest.filter((c) => c !== endCity);
      for (const first of firsts) {
        const between = rest.filter((c) => c !== first && c !== endCity);
        for (const s of subsetSums(between.map((c) => stayOf.get(c)!))) {
          add(o, d, ownStay + s);
        }
      }
    }
  }
  return out;
}

function subsetSums(values: number[]): Set<number> {
  let sums = new Set([0]);
  for (const v of values) {
    const next = new Set(sums);
    for (const s of sums) next.add(s + v);
    sums = next;
  }
  return sums;
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}
