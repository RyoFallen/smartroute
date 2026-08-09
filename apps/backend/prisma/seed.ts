import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { attractionKey, resolveOpeningHours } from '../src/services/plan/seed-opening-hours.js';
import { SeedFile } from '../src/services/plan/seed-schema.js';

/**
 * The two ODbL-marked supplementary sources of OpeningHours, kept separate from
 * the hand-curated attraction data per ADR-0005 so provenance stays traceable.
 */
export interface OpeningHoursSupplements {
  osm?: unknown;
  manual?: unknown;
}

export async function loadSeed(
  db: PrismaClient,
  data: unknown,
  supplements: OpeningHoursSupplements = {},
): Promise<void> {
  // Both parse steps throw before any DB write: a bad file must never leave the
  // database half-seeded.
  const cities = SeedFile.parse(data);
  const openingHoursByAttraction = resolveOpeningHours(cities, supplements.osm, supplements.manual);

  for (const c of cities) {
    await db.$transaction([
      db.attraction.deleteMany({ where: { cityIata: c.iata } }),
      db.city.upsert({
        where: { iata: c.iata },
        create: {
          iata: c.iata,
          altCodes: c.altCodes,
          metroIata: c.metroIata ?? null,
          name: c.name,
          country: c.country,
          lat: c.lat,
          lon: c.lon,
          timezone: c.timezone,
        },
        update: {
          altCodes: c.altCodes,
          metroIata: c.metroIata ?? null,
          name: c.name,
          country: c.country,
          lat: c.lat,
          lon: c.lon,
          timezone: c.timezone,
        },
      }),
      db.attraction.createMany({
        data: c.attractions.map((a) => ({
          cityIata: c.iata,
          name: a.name,
          category: a.category,
          mustGo: true,
          rank: a.rank,
          lat: a.lat,
          lon: a.lon,
          description: a.description,
          tags: a.tags,
          openingHours: openingHoursByAttraction.get(attractionKey(c.iata, a.name)) ?? null,
          visitMinutes: a.visitMinutes ?? null,
        })),
      }),
    ]);
  }
}

const thisFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === thisFile) {
  const db = new PrismaClient();
  const seedDir = path.join(path.dirname(thisFile), 'seed');
  const read = (name: string): unknown =>
    JSON.parse(readFileSync(path.join(seedDir, name), 'utf8'));

  loadSeed(db, read('attractions.json'), {
    osm: read('opening-hours.osm.json'),
    manual: read('opening-hours.manual.json'),
  })
    .then(() => console.log('Seeded attractions for all cities'))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => void db.$disconnect());
}
