import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { keyOf } from '../flights/cache.js';
import type { PriceResult } from '../flights/provider.js';
import { RecordedFareProvider } from '../flights/recorded.js';
import type { PriceSource } from '../optimizer/index.js';
import type { FareChecklist } from './checklist.js';
import { BENCHMARK_CITIES, IsoDate } from './scenarios.js';

const City = z.enum(BENCHMARK_CITIES);
/** A capture-sheet item ID (G07, N12, L03), so a value traces back to its screenshot. */
const Item = z.string().regex(/^[GNL]\d{2}[a-z]?$/);
const Timestamp = z.string().datetime({ offset: true });

/** One day of one date grid. */
const RecordedFare = z
  .object({
    date: IsoDate,
    /**
     * EUR minor units. `null` is "no fare": the grid showed no price that day.
     * It must be written down — a day left out is a missing transcription, not
     * a missing flight, and refuses the session.
     */
    priceCents: z.number().int().positive().nullable(),
  })
  .strict();

/**
 * One Google Flights date-grid screenshot: a directed city pair's RecordedFares.
 * A retake replaces the earlier screenshot's values, it never adds to them — a
 * fare recorded twice refuses the session.
 */
const Grid = z
  .object({
    item: Item.optional(),
    /** Curated city codes, each standing for that city's benchmark airport list. */
    origin: City,
    destination: City,
    /** When the grid was screenshotted, from the screenshot itself. */
    screenshotAt: Timestamp,
    fares: z.array(RecordedFare),
  })
  .strict();

/** A live search for one checklist fare, to measure how far the grid's cached price drifts. */
const SpotCheck = z
  .object({
    item: Item.optional(),
    origin: City,
    destination: City,
    date: IsoDate,
    /** The cheapest live one-way price, EUR minor units; null if the search found no flight. */
    livePriceCents: z.number().int().positive().nullable(),
    screenshotAt: Timestamp,
  })
  .strict();

/** How one leg of a Nomad itinerary travels, read off its carrier logo or Show details. */
export const TransportMode = z.enum(['flight', 'bus', 'train', 'ferry']);

/**
 * One scenario's Kiwi.com Nomad capture, as Nomad showed it (capture-protocol
 * § 5). Nothing here is judged during the session: whether the dates and stays
 * match the scenario's is computed afterwards, by the Nomad comparison (#40).
 */
const CompetitorResult = z
  .object({
    item: Item.optional(),
    scenarioId: z.string(),
    /** When the results list was screenshotted, from the screenshot itself. */
    capturedAt: Timestamp,
    /**
     * The first itinerary under Cheapest whose every leg is a flight: the
     * compared price. Null when no listed result is all-flight, which excludes
     * the scenario from this session's comparison.
     */
    allFlight: z
      .object({
        /** EUR minor units, as listed. */
        priceCents: z.number().int().positive(),
        /** Nomad's city order, origin to end city, by curated city code. */
        order: z.array(City),
        /** Each leg's departure date, in order. */
        legDates: z.array(IsoDate),
        /** Each place's "Stay N nights", in Nomad's order (not the end city). */
        stays: z.array(z.object({ city: City, nights: z.number().int().nonnegative() }).strict()),
      })
      .strict()
      .nullable(),
    /** The first result overall, whatever its transport: context, never compared. */
    anyMode: z
      .object({
        priceCents: z.number().int().positive(),
        /** Each leg's transport, in order. */
        modes: z.array(TransportMode),
      })
      .strict(),
  })
  .strict();
export type CompetitorResult = z.infer<typeof CompetitorResult>;

/**
 * One transcribed CaptureSession (#35): docs/benchmark/sessions/<date>.json.
 * Its fares are only ever used for this session's measurements.
 */
export const SessionFile = z
  .object({
    date: IsoDate,
    startedAt: Timestamp,
    endedAt: Timestamp,
    grids: z.array(Grid),
    /** Kiwi.com Nomad's results, at most one per scenario. */
    competitorResults: z.array(CompetitorResult).default([]),
    spotChecks: z.array(SpotCheck).default([]),
    /** The session's notes.txt exceptions, one per line, each led by its item ID. */
    notes: z.array(z.string()).default([]),
  })
  .strict();
export type SessionFile = z.infer<typeof SessionFile>;

/** Parses a session file; throws on anything that is not one, so a bad path fails at boot. */
export function loadRecordedSession(file: string): SessionFile {
  return SessionFile.parse(JSON.parse(readFileSync(file, 'utf8')));
}

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
 * needing it comes up a leg short and is infeasible: the product's rule. The
 * lookup itself is `RecordedFareProvider`'s, shared with the demo mode.
 */
export function recordedFareSource(session: SessionFile): PriceSource {
  const provider = new RecordedFareProvider(session);
  return {
    async getPrices(queries) {
      const fetched = await provider.getPrices(queries);
      const prices = new Map<string, PriceResult>(fetched.map((r) => [keyOf(r), r]));
      return { prices, partial: prices.size < queries.length, staleCache: false };
    },
  };
}
