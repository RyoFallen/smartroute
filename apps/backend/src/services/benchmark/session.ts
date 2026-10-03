import { z } from 'zod';
import { keyOf } from '../flights/cache.js';
import type { PriceResult } from '../flights/provider.js';
import type { PriceSource } from '../optimizer/index.js';
import type { FareChecklist } from './checklist.js';

const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Timestamp = z.string().datetime({ offset: true });

/** One day of one date grid. */
const RecordedFare = z.object({
  date: IsoDate,
  /**
   * EUR minor units. `null` is "no fare": the grid showed no price that day.
   * It must be written down — a day left out is a missing transcription, not
   * a missing flight, and refuses the session.
   */
  priceCents: z.number().int().positive().nullable(),
});

/** One Google Flights date-grid screenshot: a directed city pair's RecordedFares. */
const Grid = z.object({
  /** Curated city codes, each standing for that city's benchmark airport list. */
  origin: z.string(),
  destination: z.string(),
  /** When the grid was screenshotted, from the screenshot itself. */
  screenshotAt: Timestamp,
  fares: z.array(RecordedFare),
});

/**
 * One transcribed CaptureSession (#35): docs/benchmark/sessions/<date>.json.
 * Its fares are only ever used for this session's measurements.
 */
export const SessionFile = z.object({
  date: IsoDate,
  startedAt: Timestamp,
  endedAt: Timestamp,
  grids: z.array(Grid),
  /** Kiwi.com Nomad's results, one per scenario; shaped by the Nomad comparison (#40). */
  competitorResults: z.array(z.unknown()).default([]),
});
export type SessionFile = z.infer<typeof SessionFile>;

/**
 * Duration and stops are not recorded, so every RecordedFare carries the same
 * placeholder. Every order of a scenario flies the same number of legs, so
 * `fitnessScores`' min–max normalisation zeroes both terms and any preset
 * ranks by cost alone (ADR-0006).
 */
const PLACEHOLDER_DURATION_MIN = 60;

const fareLabel = (origin: string, destination: string, date: string) =>
  `${origin} → ${destination} ${date}`;

/**
 * Why a session cannot be evaluated against `checklist`, or nothing: a fare
 * recorded twice, or a checklist fare not recorded at all.
 */
export function sessionProblems(session: SessionFile, checklist: FareChecklist): string[] {
  const recorded = new Set<string>();
  const twice = new Set<string>();
  for (const grid of session.grids) {
    for (const fare of grid.fares) {
      const label = fareLabel(grid.origin, grid.destination, fare.date);
      if (recorded.has(label)) twice.add(label);
      recorded.add(label);
    }
  }

  const missing = checklist.pairs.flatMap((p) =>
    p.dates
      .map((date) => fareLabel(p.origin, p.destination, date))
      .filter((label) => !recorded.has(label)),
  );

  return [
    ...[...twice].sort().map((label) => `${label} is recorded twice`),
    ...missing.sort().map((label) => `missing ${label}`),
  ];
}

/**
 * A session's RecordedFares as the optimizer's price source, standing where
 * `FlightService` stands — in memory, so no fare reaches the price cache or
 * mixes with another session's. A "no fare" day is simply absent, so an order
 * needing it comes up a leg short and is infeasible: the product's rule.
 */
export function recordedFareSource(session: SessionFile): PriceSource {
  const byKey = new Map<
    string,
    { origin: string; destination: string; date: string; priceCents: number }
  >();
  for (const grid of session.grids) {
    for (const fare of grid.fares) {
      if (fare.priceCents === null) continue;
      byKey.set(`${grid.origin}|${grid.destination}|${fare.date}`, {
        origin: grid.origin,
        destination: grid.destination,
        date: fare.date,
        priceCents: fare.priceCents,
      });
    }
  }

  return {
    async getPrices(queries) {
      const prices = new Map<string, PriceResult>();
      for (const q of queries) {
        const fare = byKey.get(`${q.origin}|${q.destination}|${q.departDate}`);
        if (!fare || q.cabinClass !== 'ECONOMY') continue;
        prices.set(keyOf(q), {
          origin: q.origin,
          destination: q.destination,
          departDate: q.departDate,
          cabinClass: q.cabinClass,
          priceCents: fare.priceCents,
          durationMin: PLACEHOLDER_DURATION_MIN,
          stops: 0,
          carrier: null,
        });
      }
      return { prices, partial: prices.size < queries.length, staleCache: false };
    },
  };
}
