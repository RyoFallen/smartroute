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
 * without enumerating permutations. A leg o->d departs after the stays of the
 * cities visited before o, so the possible dates for a pair are the subset sums
 * of the other cities' stays — constrained by the fixed start (always in the
 * prefix unless o is the start) and fixed end (never in the prefix).
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
    for (const d of cities) {
      if (d === o) continue;
      if (startCity && d === startCity) continue;
      const rest = cities.filter((c) => c !== o && c !== d);

      if (endCity && d === endCity) {
        // d is last, so every other city precedes o.
        if (startCity && o === startCity && rest.length > 0) continue;
        add(o, d, sum(rest.map((c) => stayOf.get(c)!)));
        continue;
      }

      if (startCity && o === startCity) {
        add(o, d, 0);
        continue;
      }

      const mandatory = startCity ? stayOf.get(startCity)! : 0;
      const free = rest.filter((c) => c !== startCity && c !== endCity);
      for (const s of subsetSums(free.map((c) => stayOf.get(c)!))) {
        add(o, d, mandatory + s);
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
