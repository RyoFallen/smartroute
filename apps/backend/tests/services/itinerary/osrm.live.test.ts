import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { OsrmWalkingDistanceProvider } from '../../../src/services/itinerary/osrm.js';
import {
  DETOUR_FACTOR,
  MockWalkingDistanceProvider,
  WALKING_SPEED_KMH,
  haversineKm,
} from '../../../src/services/itinerary/walking.js';

/**
 * The only place the claim "walking times reflect real pedestrian routes" is
 * checked against a real OSRM rather than a stub, and the only place the extract
 * and the profile are exercised at all.
 *
 * Skipped unless `WALKING_PROVIDER=osrm`, so `pnpm test` and CI never need the
 * container. Run it with:
 *
 *   apps/backend/scripts/osrm/prepare-extract.sh IST
 *   docker compose --profile osrm up -d osrm
 *   WALKING_PROVIDER=osrm pnpm --filter @smartroute/backend exec vitest run \
 *     tests/services/itinerary/osrm.live.test.ts
 *
 * See `scripts/osrm/README.md`. `prepare-extract.sh IST` is enough — every
 * assertion here is about Istanbul.
 */
const LIVE = process.env.WALKING_PROVIDER === 'osrm';
const BASE_URL = process.env.OSRM_BASE_URL ?? 'http://localhost:5050';

interface SeedAttraction {
  name: string;
  lat: number;
  lon: number;
}

const here = dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(
  readFileSync(join(here, '../../../prisma/seed/attractions.json'), 'utf8'),
) as Array<{ iata: string; attractions: SeedAttraction[] }>;

const ISTANBUL = seed.find((c) => c.iata === 'IST')!.attractions;
const at = (name: string): { lat: number; lon: number } => {
  const found = ISTANBUL.find((a) => a.name.startsWith(name));
  if (!found) throw new Error(`No seeded Istanbul attraction named ${name}`);
  return { lat: found.lat, lon: found.lon };
};

// Real seed coordinates, not copies — a moved attraction must change what these
// assertions measure rather than silently keep testing an old location.
const HAGIA_SOPHIA = at('Hagia Sophia'); // historic peninsula, south bank
const GALATA_TOWER = at('Galata Tower'); // Beyoğlu, north bank
const SPICE_BAZAAR = at('Spice Bazaar'); // south bank, the control

const minutesFor = (km: number): number => Math.ceil((km / WALKING_SPEED_KMH) * 60);
const asLonLat = (p: { lat: number; lon: number }): string => `${p.lon},${p.lat}`;

async function osrm(path: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE_URL}${path}`);
  const body = (await res.json()) as Record<string, unknown>;
  expect(body.code).toBe('Ok');
  return body;
}

describe.skipIf(!LIVE)('OSRM foot profile, against the real service', () => {
  const provider = new OsrmWalkingDistanceProvider({ baseUrl: BASE_URL });

  it('crosses the Golden Horn on the Galata Bridge rather than the water', async () => {
    // The barrier case, checked directly instead of inferred from a distance
    // ratio: the pedestrian route between the two banks must actually use a
    // named bridge. A ratio can be satisfied by any long detour; this cannot.
    const body = await osrm(
      `/route/v1/foot/${asLonLat(HAGIA_SOPHIA)};${asLonLat(GALATA_TOWER)}?steps=true&overview=false`,
    );
    const steps = (body.routes as Array<{ legs: Array<{ steps: Array<Record<string, unknown>> }> }>)
      .at(0)!
      .legs.at(0)!.steps;

    const bridge = steps.find((s) => String(s.name).includes('Galata Köprüsü'));
    expect(bridge, 'route should walk over Galata Köprüsü').toBeDefined();
    expect(bridge!.mode).toBe('walking');
    expect(bridge!.distance).toBeGreaterThan(400); // the span is ~490 m
  });

  it('costs more than the mock believes, because the mock ignores the water', async () => {
    const straightLineKm = haversineKm(HAGIA_SOPHIA, GALATA_TOWER);
    const pair: [typeof HAGIA_SOPHIA, typeof GALATA_TOWER] = [HAGIA_SOPHIA, GALATA_TOWER];
    const osrmMinutes = (await provider.matrix(pair))[0]![1]!;
    const mockMinutes = (await new MockWalkingDistanceProvider().matrix(pair))[0]![1]!;

    // Measured on the pinned 260815 extract: 2.09 km apart, 3.17 km on foot —
    // a 1.52x detour, 39 minutes against the mock's 33. Bounded on both sides so
    // that a graph returning nonsense fails rather than passes for being large.
    expect(osrmMinutes).toBeGreaterThan(mockMinutes);
    expect(osrmMinutes).toBeGreaterThanOrEqual(minutesFor(straightLineKm * 1.4));
    expect(osrmMinutes).toBeLessThanOrEqual(minutesFor(straightLineKm * 2));
  });

  it('stays close to the mock where nothing is in the way', async () => {
    // Both on the historic peninsula with ordinary streets between them, so the
    // stock 1.3 detour factor is about right. This is what makes the assertion
    // above about the Golden Horn, and not about OSRM returning bigger numbers
    // everywhere.
    const osrmMinutes = (await provider.matrix([SPICE_BAZAAR, HAGIA_SOPHIA]))[0]![1]!;
    const straightLineKm = haversineKm(SPICE_BAZAAR, HAGIA_SOPHIA);

    expect(osrmMinutes).toBeLessThanOrEqual(minutesFor(straightLineKm * DETOUR_FACTOR * 1.6));
  });

  it('never puts the traveler on a boat', async () => {
    // The regression that motivated `foot-smartroute.lua`: OSRM's stock foot
    // profile routed Galata Tower to Dolmabahçe Palace over a Bosphorus
    // sightseeing cruise at 48 km/h and called it walking. Any pair covering
    // ground faster than a person walks means ferries are back in the graph.
    const coords = ISTANBUL.map(asLonLat).join(';');
    const body = await osrm(`/table/v1/foot/${coords}?annotations=duration,distance`);
    const durations = body.durations as number[][];
    const distances = body.distances as number[][];

    const tooFast: string[] = [];
    for (let i = 0; i < ISTANBUL.length; i++) {
      for (let j = i + 1; j < ISTANBUL.length; j++) {
        const kmh = distances[i]![j]! / 1000 / (durations[i]![j]! / 3600);
        if (kmh > 6) {
          tooFast.push(`${ISTANBUL[i]!.name} -> ${ISTANBUL[j]!.name} at ${kmh.toFixed(1)} km/h`);
        }
      }
    }
    expect(tooFast).toEqual([]);
  });

  it('returns a full square table for a whole city', async () => {
    const points = ISTANBUL.map((a) => ({ lat: a.lat, lon: a.lon }));
    const matrix = await provider.matrix(points);

    expect(matrix).toHaveLength(points.length);
    expect(matrix.every((row) => row.length === points.length)).toBe(true);
    expect(matrix.map((row, i) => row[i])).toEqual(points.map(() => 0));
    // Every pair is routable on a correctly built extract. A fallback estimate
    // here means a coordinate fell outside the clipped bounding box.
    expect(matrix.flat().every((m) => Number.isFinite(m) && m >= 0)).toBe(true);
  });
});
