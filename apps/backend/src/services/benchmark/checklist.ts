import { collectPriceTriples } from '../optimizer/triples.js';
import { optimizerInput, type BenchmarkScenario } from './scenarios.js';

/** Every date one directed city pair needs a RecordedFare for. */
export interface PairFares {
  origin: string;
  destination: string;
  /** Ascending, distinct. */
  dates: string[];
  earliest: string;
  latest: string;
}

export interface FareChecklist {
  /** Sorted by origin, then destination. */
  pairs: PairFares[];
  /** Distinct (origin, destination, date) prices across every pair. */
  totalFares: number;
}

/**
 * Exactly which RecordedFares the scenarios need: the union of the price
 * queries the optimizer itself issues for each one (start and end pinned),
 * grouped by directed pair so the operator knows which date grids — and which
 * months of each — to capture.
 */
export function fareChecklist(scenarios: BenchmarkScenario[]): FareChecklist {
  const byPair = new Map<string, { origin: string; destination: string; dates: Set<string> }>();
  for (const s of scenarios) {
    for (const q of collectPriceTriples(optimizerInput(s))) {
      const key = `${q.origin}|${q.destination}`;
      let pair = byPair.get(key);
      if (!pair) {
        pair = { origin: q.origin, destination: q.destination, dates: new Set() };
        byPair.set(key, pair);
      }
      pair.dates.add(q.departDate);
    }
  }

  const pairs = [...byPair.values()]
    .map(({ origin, destination, dates }) => {
      const sorted = [...dates].sort();
      return { origin, destination, dates: sorted, earliest: sorted[0]!, latest: sorted.at(-1)! };
    })
    .sort((a, b) => a.origin.localeCompare(b.origin) || a.destination.localeCompare(b.destination));

  return { pairs, totalFares: pairs.reduce((n, p) => n + p.dates.length, 0) };
}
