import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SessionFile } from '../benchmark/session.js';
import type { FlightProvider, PriceQuery, PriceResult } from './provider.js';

/** Session 1 (1 Nov 2026), the only CaptureSession the benchmark reports; relative to the repo root. */
export const DEFAULT_RECORDED_SESSION = 'docs/benchmark/sessions/2026-11-01.json';

/**
 * Duration and stops are not recorded, so every RecordedFare carries the same
 * placeholder. Every order of a scenario flies the same number of legs, so
 * `fitnessScores`' min–max normalisation zeroes both terms and any preset
 * ranks by cost alone (ADR-0006).
 */
export const PLACEHOLDER_DURATION_MIN = 60;

const fareLabel = (origin: string, destination: string, date: string) =>
  `${origin} → ${destination} ${date}`;

/**
 * Real Google Flights prices from a transcribed CaptureSession, served as a
 * FlightProvider: the "recorded fares" demo mode (`FLIGHT_PROVIDER=recorded`).
 * Without it, the live app runs on the mock's or Duffel test mode's synthetic
 * fares, while only the benchmark sees real ones.
 *
 * Coverage is the session's: the eight benchmark cities, economy, departures
 * 28 Nov – 22 Dec 2026. Anything else has no fare and is left out, so an order
 * needing it is infeasible, as a sold-out flight would be. Prices are EUR minor
 * units as captured; carrier, times and stops were not recorded.
 *
 * Not cacheable: these prices are a fixed snapshot and must not leak into, or
 * be shadowed by, the price cache that the mock and Duffel share.
 */
export class RecordedFareProvider implements FlightProvider {
  readonly currency = 'EUR';
  readonly cacheable = false;
  private readonly priceOf = new Map<string, number>();

  constructor(session: SessionFile) {
    for (const grid of session.grids) {
      for (const fare of grid.fares) {
        if (fare.priceCents === null) continue;
        this.priceOf.set(fareLabel(grid.origin, grid.destination, fare.date), fare.priceCents);
      }
    }
  }

  async getPrices(queries: PriceQuery[]): Promise<PriceResult[]> {
    return queries.flatMap((q) => {
      const priceCents = this.priceOf.get(fareLabel(q.origin, q.destination, q.departDate));
      if (priceCents === undefined || q.cabinClass !== 'ECONOMY') return [];
      return [
        {
          origin: q.origin,
          destination: q.destination,
          departDate: q.departDate,
          cabinClass: q.cabinClass,
          priceCents,
          durationMin: PLACEHOLDER_DURATION_MIN,
          stops: 0,
          carrier: null,
        },
      ];
    });
  }
}

/**
 * The session file to load. A relative path is taken from the repo root (found
 * by walking up to `pnpm-workspace.yaml`), so it works whether the server runs
 * from the root, from `apps/backend` or from a build output.
 */
export function resolveRecordedSessionPath(configured: string | undefined): string {
  const file = configured ?? DEFAULT_RECORDED_SESSION;
  return path.isAbsolute(file) ? file : path.join(repoRoot(), file);
}

function repoRoot(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  while (!existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error('repo root (pnpm-workspace.yaml) not found');
    dir = parent;
  }
  return dir;
}
