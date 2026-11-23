/**
 * Itinerary generation time against the spec §2.4 target (< 5 s per city).
 *
 * Run manually (never CI):  pnpm exec tsx scripts/benchmark-itinerary.ts
 *
 * Feeds `generateItinerary` from the committed seed (the same attractions and
 * resolved OpeningHours `prisma/seed.ts` writes), so no database or network is
 * needed. Walking minutes come from the mock provider and its time is counted.
 * Measured:
 *   1. every seeded city alone, over stay lengths × TripIntensity × two Interest
 *      profiles, with an arrival and a departure flight bounding the stay;
 *   2. a synthetic worst case at MAX_EXACT_TOUR_NODES attractions, the most the
 *      Held–Karp walking route accepts;
 *   3. one trip through all eight cities, divided by eight.
 * Not measured here: the Postgres reads and the OSRM table request a live
 * `GET /trips/:id/itinerary` also makes (see the doc this writes).
 *
 * Writes docs/presentation/itinerary-benchmark.md.
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import type { InterestEntry, TripIntensity } from '@smartroute/shared';
import { AttractionCategory } from '@smartroute/shared';
import { attractionKey, resolveOpeningHours } from '../src/services/plan/seed-opening-hours.js';
import { SeedFile } from '../src/services/plan/seed-schema.js';
import type { SeedCity } from '../src/services/plan/seed-schema.js';
import { generateItinerary } from '../src/services/itinerary/generate.js';
import type { AvailableCityInput, ItineraryInput } from '../src/services/itinerary/generate.js';
import { MAX_EXACT_TOUR_NODES } from '../src/services/itinerary/tour.js';
import { MockWalkingDistanceProvider } from '../src/services/itinerary/walking.js';

const TARGET_MS = 5000;
const WARMUP_RUNS = 5;
const TIMED_RUNS = 25;
const STAY_DAYS = [1, 2, 3, 5, 7];
const INTENSITIES: TripIntensity[] = ['RELAXED', 'MODERATE', 'PACKED'];
const START = '2026-12-01';
/** A rated profile, so `selectAttractions` reorders by Interest instead of rank alone. */
const RATED: InterestEntry[] = [
  { category: 'museums-galleries', rating: 1 },
  { category: 'historical-sites', rating: 1 },
  { category: 'religious-sites', rating: -1 },
  { category: 'nature-parks', rating: 0 },
];
const PROFILES: { name: string; interests: InterestEntry[] | undefined }[] = [
  { name: 'unrated', interests: undefined },
  { name: 'rated', interests: RATED },
];

const thisFile = fileURLToPath(import.meta.url);
const backendDir = path.resolve(path.dirname(thisFile), '..');
const seedDir = path.join(backendDir, 'prisma', 'seed');
const read = (name: string): unknown => JSON.parse(readFileSync(path.join(seedDir, name), 'utf8'));

const walking = new MockWalkingDistanceProvider();

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

type CityAttractions = AvailableCityInput['attractions'];

function attractionsOf(city: SeedCity, hours: Map<string, string>): CityAttractions {
  return [...city.attractions]
    .sort((a, b) => a.rank - b.rank)
    .map((a, i) => ({
      id: `${city.iata}-${i}`,
      name: a.name,
      category: AttractionCategory.parse(a.category),
      lat: a.lat,
      lon: a.lon,
      description: a.description,
      visitMinutes: a.visitMinutes ?? null,
      openingHours: hours.get(attractionKey(city.iata, a.name)) ?? null,
    }));
}

/**
 * One stay bounded by flights: lands 11:00 UTC on the first day, leaves 17:00
 * UTC on the last. A one-day stay is then a short transit day, the tightest
 * window the generator has to fit.
 */
async function cityInput(
  city: SeedCity,
  attractions: CityAttractions,
  days: number,
): Promise<{ start: string; end: string; input: AvailableCityInput }> {
  const end = addDays(START, days - 1);
  return {
    start: START,
    end,
    input: {
      iata: city.iata,
      available: true,
      name: city.name,
      timezone: city.timezone,
      attractions,
      walkMinutes: await walking.matrix(attractions.map((a) => ({ lat: a.lat, lon: a.lon }))),
      arriveAt: `${START}T11:00:00.000Z`,
      departAt: `${end}T17:00:00.000Z`,
    },
  };
}

/** Wall-clock of one full pipeline run: walking matrix + generation. */
async function timeOnce(build: () => Promise<ItineraryInput>): Promise<number> {
  const t0 = performance.now();
  const input = await build();
  const out = generateItinerary(input);
  const ms = performance.now() - t0;
  if (out.cities.length !== input.cities.length) throw new Error('generator dropped a city');
  return ms;
}

async function sample(build: () => Promise<ItineraryInput>): Promise<number[]> {
  for (let i = 0; i < WARMUP_RUNS; i++) await timeOnce(build);
  const runs: number[] = [];
  for (let i = 0; i < TIMED_RUNS; i++) runs.push(await timeOnce(build));
  return runs;
}

function quantile(sorted: number[], q: number): number {
  return sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)]!;
}

interface Stats {
  median: number;
  p95: number;
  max: number;
  n: number;
}

function stats(values: number[]): Stats {
  const s = [...values].sort((a, b) => a - b);
  return { median: quantile(s, 0.5), p95: quantile(s, 0.95), max: s.at(-1)!, n: s.length };
}

function fmtMs(ms: number): string {
  return ms >= 100
    ? `${ms.toFixed(0)} ms`
    : ms >= 1
      ? `${ms.toFixed(1)} ms`
      : `${ms.toFixed(2)} ms`;
}

/**
 * MAX_EXACT_TOUR_NODES attractions: the city's own plus copies nudged ~300 m
 * east, so walking times stay city-like and the Held–Karp table is full size.
 */
function paddedToMax(attractions: CityAttractions): CityAttractions {
  const out = [...attractions];
  for (let i = 0; out.length < MAX_EXACT_TOUR_NODES; i++) {
    const base = attractions[i % attractions.length]!;
    out.push({
      ...base,
      id: `${base.id}-pad${i}`,
      name: `${base.name} (copy ${i})`,
      lon: base.lon + 0.004 * (i + 1),
    });
  }
  return out;
}

async function main(): Promise<void> {
  const cities = SeedFile.parse(read('attractions.json'));
  const hours = resolveOpeningHours(
    cities,
    read('opening-hours.osm.json'),
    read('opening-hours.manual.json'),
  );

  // 1. Each seeded city alone, across the configuration grid.
  const perCity: { iata: string; name: string; attractions: number; s: Stats; worst: string }[] =
    [];
  for (const city of cities) {
    const attractions = attractionsOf(city, hours);
    const all: number[] = [];
    let worst = { ms: -1, label: '' };
    for (const days of STAY_DAYS) {
      for (const intensity of INTENSITIES) {
        for (const profile of PROFILES) {
          const runs = await sample(async () => {
            const { start, end, input } = await cityInput(city, attractions, days);
            return {
              tripId: 'bench',
              startDate: start,
              endDate: end,
              wakeUpTime: '09:00',
              intensity,
              interests: profile.interests,
              cities: [input],
            };
          });
          all.push(...runs);
          const m = Math.max(...runs);
          if (m > worst.ms) worst = { ms: m, label: `${days} d, ${intensity}, ${profile.name}` };
        }
      }
    }
    perCity.push({
      iata: city.iata,
      name: city.name,
      attractions: attractions.length,
      s: stats(all),
      worst: worst.label,
    });
    console.log(`done: ${city.iata}`);
  }

  // 2. Synthetic worst case at the Held–Karp bound.
  const biggest = cities.reduce((a, b) => (b.attractions.length > a.attractions.length ? b : a));
  const padded = paddedToMax(attractionsOf(biggest, hours));
  const stress: { days: number; s: Stats }[] = [];
  for (const days of STAY_DAYS) {
    const runs = await sample(async () => {
      const { start, end, input } = await cityInput(biggest, padded, days);
      return {
        tripId: 'bench',
        startDate: start,
        endDate: end,
        wakeUpTime: '09:00',
        intensity: 'PACKED',
        interests: RATED,
        cities: [input],
      };
    });
    stress.push({ days, s: stats(runs) });
  }
  console.log('done: stress');

  // 3. One trip through all eight cities, two days each, flights between them.
  const tripRuns = await sample(async () => {
    const inputs: AvailableCityInput[] = [];
    for (const [i, city] of cities.entries()) {
      const attractions = attractionsOf(city, hours);
      const day0 = addDays(START, i * 2);
      const day1 = addDays(day0, 1);
      inputs.push({
        iata: city.iata,
        available: true,
        name: city.name,
        timezone: city.timezone,
        attractions,
        walkMinutes: await walking.matrix(attractions.map((a) => ({ lat: a.lat, lon: a.lon }))),
        arriveAt: i === 0 ? null : `${day0}T11:00:00.000Z`,
        departAt: i === cities.length - 1 ? null : `${day1}T17:00:00.000Z`,
      });
    }
    return {
      tripId: 'bench',
      startDate: START,
      endDate: addDays(START, cities.length * 2 - 1),
      wakeUpTime: '09:00',
      intensity: 'MODERATE',
      interests: RATED,
      cities: inputs,
    };
  });
  const trip = stats(tripRuns);
  console.log('done: full trip');

  const allCityRuns = perCity.map((c) => c.s.max);
  const worstSeeded = Math.max(...allCityRuns);
  const worstStress = Math.max(...stress.map((r) => r.s.max));
  const runsPerCity = STAY_DAYS.length * INTENSITIES.length * PROFILES.length * TIMED_RUNS;
  const cpu = os.cpus()[0]?.model.trim() ?? 'unknown CPU';
  const today = new Date().toISOString().slice(0, 10);

  const doc = `# Itinerary generation benchmark

Generated by \`apps/backend/scripts/benchmark-itinerary.ts\` on ${today}, Node ${process.version},
${cpu}, ${os.platform()}. Rerun with \`pnpm exec tsx scripts/benchmark-itinerary.ts\` from
\`apps/backend/\`. Target (spec §2.4): **itinerary generation < 5 s per city**.

## Verdict

- Slowest single run for any seeded city: **${fmtMs(worstSeeded)}**, which is ${(TARGET_MS / worstSeeded).toFixed(0)}× under the 5 s target.
- Slowest run at the Held–Karp bound (${MAX_EXACT_TOUR_NODES} attractions, more than any seeded city holds): **${fmtMs(worstStress)}**.
- A whole eight-city trip: median **${fmtMs(trip.median)}** (${fmtMs(trip.median / cities.length)} per city).

## What is measured

Each timed run is the full in-process pipeline for one request: the walking-time matrix
from the mock WalkingDistanceProvider, then \`generateItinerary\` (attraction selection,
the exact Held–Karp WalkingRoute, the dynamic-programming split of the route over the
days, and the OpeningHours checks). Input is the committed seed, with OpeningHours resolved
exactly as \`prisma/seed.ts\` stores them. Every configuration gets ${WARMUP_RUNS} warm-up runs
and ${TIMED_RUNS} timed ones. Each stay is bounded by flights (arrival 11:00 UTC on the first
day, departure 17:00 UTC on the last), so a 1-day stay is a short transit day.

Per city the grid is stay length {${STAY_DAYS.join(', ')}} days × TripIntensity
{${INTENSITIES.join(', ')}} × Interest profile {unrated, rated}: ${runsPerCity} timed runs per city.

**Not included:** a live \`GET /trips/:id/itinerary\` also reads the trip, profile and
attractions from Postgres and asks OSRM for one walking table per city (≤ 15 points).
Both are single round-trips to services on the same host. They are a network cost on top of
these figures, not a change in how the work grows. They could not be timed on this machine,
which has no OSRM extract. This is a threat to validity worth stating in the thesis.

## Seeded cities

| City | Attractions | Median | p95 | Max | Slowest configuration |
| --- | --- | --- | --- | --- | --- |
${perCity.map((c) => `| ${c.name} (${c.iata}) | ${c.attractions} | ${fmtMs(c.s.median)} | ${fmtMs(c.s.p95)} | ${fmtMs(c.s.max)} | ${c.worst} |`).join('\n')}

## Worst case: ${MAX_EXACT_TOUR_NODES} attractions (${biggest.name} padded), PACKED, rated

| Stay | Median | p95 | Max |
| --- | --- | --- | --- |
${stress.map((r) => `| ${r.days} d | ${fmtMs(r.s.median)} | ${fmtMs(r.s.p95)} | ${fmtMs(r.s.max)} |`).join('\n')}

## Whole trip: all ${cities.length} cities, 2 days each, MODERATE, rated

| Median | p95 | Max | Median per city |
| --- | --- | --- | --- |
| ${fmtMs(trip.median)} | ${fmtMs(trip.p95)} | ${fmtMs(trip.max)} | ${fmtMs(trip.median / cities.length)} |
`;

  const outPath = path.resolve(
    backendDir,
    '..',
    '..',
    'docs',
    'presentation',
    'itinerary-benchmark.md',
  );
  writeFileSync(outPath, doc);
  execSync(`pnpm exec prettier --write ${JSON.stringify(outPath)}`, {
    stdio: 'inherit',
    cwd: backendDir,
  });
  console.log(`wrote ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
