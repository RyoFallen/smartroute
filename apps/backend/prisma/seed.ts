import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { SeedFile } from '../src/services/plan/seed-schema.js';

export async function loadSeed(db: PrismaClient, data: unknown): Promise<void> {
  const cities = SeedFile.parse(data); // throws before any DB write
  for (const c of cities) {
    await db.$transaction([
      db.attraction.deleteMany({ where: { cityIata: c.iata } }),
      db.city.upsert({
        where: { iata: c.iata },
        create: {
          iata: c.iata,
          altCodes: c.altCodes,
          name: c.name,
          country: c.country,
          lat: c.lat,
          lon: c.lon,
          timezone: c.timezone,
        },
        update: {
          altCodes: c.altCodes,
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
        })),
      }),
    ]);
  }
}

const thisFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === thisFile) {
  const db = new PrismaClient();
  const jsonPath = path.join(path.dirname(thisFile), 'seed', 'attractions.json');
  loadSeed(db, JSON.parse(readFileSync(jsonPath, 'utf8')))
    .then(() => console.log('Seeded attractions for all cities'))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => void db.$disconnect());
}
