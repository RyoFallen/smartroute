# Plan 6 — Trip Planning Layer: Must-Go Attractions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** From a saved trip, `GET /trips/:id/plan` returns each city's curated must-go attractions in visiting order, rendered on a new mobile `TripPlanScreen`.

**Architecture:** A new `Attraction` Prisma model hangs off the existing (currently unused) `City` model. A hand-curated JSON dataset for 8 cities is loaded by an idempotent `prisma/seed.ts`. A `PlanService` derives visiting order from the trip's flight-leg chain and joins attractions; cities without data return `available: false`. Mobile adds one screen + one hook following existing patterns.

**Tech Stack:** Fastify + Prisma + Postgres, zod schemas in `@smartroute/shared`, Expo/React Native, vitest (tests hit a real Postgres via `tests/setup-db.ts`).

**Spec:** `docs/superpowers/specs/2026-06-12-trip-planning-mustgo-design.md`

**Spec addendum (discovered during planning):** trips store airport IATA codes, and two seeded cities have multiple codes in the mobile picker (London LHR+LGW, Paris CDG+ORY). `City` therefore gains `altCodes String[] @default([])`; `PlanService` resolves either code to the same city. Task 2 patches the spec to record this.

**Conventions to respect (from the codebase):**

- Backend imports use `.js` suffixes (ESM NodeNext).
- Prisma enums are not used; `category` is `String` in Prisma, validated by a zod enum in shared (same as `cabinClass`).
- Services are classes taking `PrismaClient` in the constructor; routes instantiate per request (`new TripService(app.prisma)`).
- Backend service tests import `prisma` from `tests/setup-db.ts` (real DB, truncated between tests). Route tests use `buildServer({ withDb: true })` and mock `@clerk/backend` with `Bearer u_<userId>` tokens.
- Local Postgres must be running for tests/migrations: `docker compose up -d` from repo root.
- Run all commands from repo root `C:\repos\smartroute`.

---

### Task 1: Shared schemas (`@smartroute/shared`)

**Files:**

- Create: `packages/shared/src/attractions.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Create `packages/shared/src/attractions.ts`**

```ts
import { z } from 'zod';
import { Iata } from './flights.js';

export const AttractionCategory = z.enum([
  'LANDMARK',
  'MUSEUM',
  'RELIGIOUS',
  'PARK',
  'VIEWPOINT',
  'HISTORICAL',
  'MARKET',
]);
export type AttractionCategory = z.infer<typeof AttractionCategory>;

export const Attraction = z.object({
  id: z.string(),
  name: z.string(),
  category: AttractionCategory,
  rank: z.number().int().positive(),
  lat: z.number(),
  lon: z.number(),
  description: z.string(),
});
export type Attraction = z.infer<typeof Attraction>;

export const TripPlanCity = z.object({
  iata: Iata,
  name: z.string().nullable(), // null when the city is not in our database
  available: z.boolean(), // false => "no guide for this city yet"
  mustGo: z.array(Attraction), // empty when !available
});
export type TripPlanCity = z.infer<typeof TripPlanCity>;

export const TripPlanResponse = z.object({
  tripId: z.string(),
  cities: z.array(TripPlanCity), // in visiting order
});
export type TripPlanResponse = z.infer<typeof TripPlanResponse>;
```

- [ ] **Step 2: Export from `packages/shared/src/index.ts`** — add one line at the end:

```ts
export * from './attractions.js';
```

- [ ] **Step 3: Build + typecheck**

Run: `pnpm --filter @smartroute/shared build && pnpm typecheck`
Expected: both exit 0.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/attractions.ts packages/shared/src/index.ts
git commit -m "feat(shared): attraction + trip-plan schemas for Plan 6"
```

---

### Task 2: Prisma schema, migration, seed wiring

**Files:**

- Modify: `apps/backend/prisma/schema.prisma`
- Modify: `apps/backend/package.json`
- Modify: `apps/backend/tests/setup-db.ts`
- Modify: `docs/superpowers/specs/2026-06-12-trip-planning-mustgo-design.md` (altCodes addendum)

- [ ] **Step 1: Edit `schema.prisma`** — replace the existing `City` model and add `Attraction`:

```prisma
model City {
  iata        String       @id
  altCodes    String[]     @default([])
  name        String
  country     String
  lat         Float
  lon         Float
  timezone    String
  attractions Attraction[]
}

model Attraction {
  id          String   @id @default(cuid())
  cityIata    String
  name        String
  category    String // validated against AttractionCategory (zod) at seed time
  mustGo      Boolean  @default(true)
  rank        Int // 1 = most iconic; display order within a city
  lat         Float
  lon         Float
  description String
  tags        String[] // unused in Plan 6 responses; powers Plan 7 filtering
  city        City     @relation(fields: [cityIata], references: [iata])

  @@unique([cityIata, name])
  @@index([cityIata, mustGo, rank])
}
```

- [ ] **Step 2: Run the migration** (Postgres must be up: `docker compose up -d`)

Run: `pnpm --filter @smartroute/backend exec prisma migrate dev --name add_attractions`
Expected: new folder under `apps/backend/prisma/migrations/`, client regenerated, exit 0.

- [ ] **Step 3: Wire the seed command in `apps/backend/package.json`** — add to `"scripts"`:

```json
"db:seed": "tsx prisma/seed.ts"
```

and add a top-level key (sibling of `"scripts"`):

```json
"prisma": { "seed": "tsx prisma/seed.ts" }
```

(`prisma/seed.ts` itself is created in Task 4; the wiring is inert until then.)

- [ ] **Step 4: Extend test cleanup in `apps/backend/tests/setup-db.ts`** — replace the `beforeEach` with (attractions before cities, FK order):

```ts
beforeEach(async () => {
  await prisma.$transaction([
    prisma.trip.deleteMany(),
    prisma.flightPriceCache.deleteMany(),
    prisma.attraction.deleteMany(),
    prisma.city.deleteMany(),
  ]);
});
```

- [ ] **Step 5: Patch the spec** — in the spec file section 4.1, replace the sentence beginning "The existing `City` model keeps all its columns" with:

```markdown
The existing `City` model keeps all its columns (`iata` PK, `name`, `country`, `lat`, `lon`, `timezone`) and gains `altCodes String[] @default([])` (secondary airport codes that resolve to the same city — London is LHR + LGW, Paris CDG + ORY) plus the Prisma back-reference `attractions Attraction[]`. One new model:
```

and add `altCodes` to the spec's seed-dataset example for any multi-airport city.

- [ ] **Step 6: Verify existing tests still pass**

Run: `pnpm --filter @smartroute/backend test`
Expected: all 55 tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/prisma apps/backend/package.json apps/backend/tests/setup-db.ts docs/superpowers/specs/2026-06-12-trip-planning-mustgo-design.md
git commit -m "feat(backend): Attraction model + City.altCodes, seed wiring, migration"
```

---

### Task 3: Seed schema + curated dataset (TDD on the data itself)

**Files:**

- Create: `apps/backend/src/services/plan/seed-schema.ts`
- Create: `apps/backend/tests/services/plan/seed-data.test.ts`
- Create: `apps/backend/prisma/seed/attractions.json`

- [ ] **Step 1: Create `apps/backend/src/services/plan/seed-schema.ts`** (lives in `src` so it is typechecked and importable from both `prisma/seed.ts` and tests):

```ts
import { z } from 'zod';
import { AttractionCategory, Iata } from '@smartroute/shared';

export const SeedAttraction = z.object({
  name: z.string().min(1),
  category: AttractionCategory,
  rank: z.number().int().positive(),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  description: z.string().min(10).max(300),
  tags: z.array(z.string().min(1)).min(1),
});
export type SeedAttraction = z.infer<typeof SeedAttraction>;

export const SeedCity = z.object({
  iata: Iata,
  altCodes: z.array(Iata).default([]),
  name: z.string().min(1),
  country: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  timezone: z.string().min(1),
  attractions: z.array(SeedAttraction).min(8),
});
export type SeedCity = z.infer<typeof SeedCity>;

export const SeedFile = z.array(SeedCity).min(1);
export type SeedFile = z.infer<typeof SeedFile>;
```

- [ ] **Step 2: Write the data QA test** `apps/backend/tests/services/plan/seed-data.test.ts` — this is the automated reviewer for the curated JSON:

```ts
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { SeedFile } from '../../../src/services/plan/seed-schema.js';

// ESM project — no __dirname; resolve relative to this file via import.meta.url
const file = new URL('../../../prisma/seed/attractions.json', import.meta.url);
const raw: unknown = JSON.parse(readFileSync(file, 'utf8'));

describe('attractions seed data', () => {
  it('parses against the seed schema', () => {
    expect(() => SeedFile.parse(raw)).not.toThrow();
  });

  const cities = SeedFile.parse(raw);

  it('covers exactly the 8 starter cities', () => {
    const codes = cities.map((c) => c.iata).sort();
    expect(codes).toEqual(['BCN', 'BER', 'BUD', 'CDG', 'FCO', 'IST', 'LHR', 'WAW']);
  });

  it('has 10-15 attractions per city with unique names', () => {
    for (const c of cities) {
      expect(c.attractions.length, c.iata).toBeGreaterThanOrEqual(10);
      expect(c.attractions.length, c.iata).toBeLessThanOrEqual(15);
      const names = new Set(c.attractions.map((a) => a.name));
      expect(names.size, c.iata).toBe(c.attractions.length);
    }
  });

  it('ranks are exactly 1..n within each city', () => {
    for (const c of cities) {
      const ranks = c.attractions.map((a) => a.rank).sort((a, b) => a - b);
      expect(ranks, c.iata).toEqual(Array.from({ length: ranks.length }, (_, i) => i + 1));
    }
  });

  it('every attraction is near its city center (~within 60km)', () => {
    for (const c of cities) {
      for (const a of c.attractions) {
        expect(Math.abs(a.lat - c.lat), `${c.iata}/${a.name}`).toBeLessThan(0.6);
        expect(Math.abs(a.lon - c.lon), `${c.iata}/${a.name}`).toBeLessThan(0.8);
      }
    }
  });

  it('multi-airport cities declare their alternates', () => {
    const byIata = new Map(cities.map((c) => [c.iata, c]));
    expect(byIata.get('LHR')?.altCodes).toContain('LGW');
    expect(byIata.get('CDG')?.altCodes).toContain('ORY');
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter @smartroute/backend exec vitest run tests/services/plan/seed-data.test.ts`
Expected: FAIL — `ENOENT ... attractions.json` (file does not exist yet).

- [ ] **Step 4: Author `apps/backend/prisma/seed/attractions.json`**

This is curated content. The full Istanbul entry below is the gold template — copy its structure and quality bar for the other 7 cities. Coordinates are the landmark's actual location (the QA test rejects anything >~60km from the city center); descriptions are 1–2 concrete sentences, no marketing fluff; tags are lowercase free-form (they power Plan 7 filtering: think `history`, `art`, `architecture`, `views`, `food`, `nature`, `religious`, `shopping`, `photography`).

```jsonc
[
  {
    "iata": "IST",
    "altCodes": [],
    "name": "Istanbul",
    "country": "Türkiye",
    "lat": 41.0082,
    "lon": 28.9784,
    "timezone": "Europe/Istanbul",
    "attractions": [
      {
        "name": "Hagia Sophia",
        "category": "RELIGIOUS",
        "rank": 1,
        "lat": 41.0086,
        "lon": 28.985,
        "description": "Byzantine cathedral turned mosque — 1,500 years of empire under one vast dome.",
        "tags": ["history", "architecture", "religious"],
      },
      {
        "name": "Blue Mosque (Sultanahmet Camii)",
        "category": "RELIGIOUS",
        "rank": 2,
        "lat": 41.0054,
        "lon": 28.9768,
        "description": "Six minarets and 20,000 handmade İznik tiles; still an active mosque.",
        "tags": ["religious", "architecture"],
      },
      {
        "name": "Topkapı Palace",
        "category": "HISTORICAL",
        "rank": 3,
        "lat": 41.0115,
        "lon": 28.9834,
        "description": "Seat of the Ottoman sultans for 400 years — courtyards, treasury, and Bosphorus views.",
        "tags": ["history", "views"],
      },
      {
        "name": "Basilica Cistern",
        "category": "HISTORICAL",
        "rank": 4,
        "lat": 41.0084,
        "lon": 28.9779,
        "description": "Atmospheric 6th-century underground reservoir held up by 336 columns, two carved with Medusa heads.",
        "tags": ["history", "photography"],
      },
      {
        "name": "Grand Bazaar",
        "category": "MARKET",
        "rank": 5,
        "lat": 41.0108,
        "lon": 28.968,
        "description": "One of the world's oldest covered markets — 4,000 shops across 61 streets.",
        "tags": ["shopping", "history"],
      },
      {
        "name": "Galata Tower",
        "category": "VIEWPOINT",
        "rank": 6,
        "lat": 41.0256,
        "lon": 28.9744,
        "description": "Medieval Genoese tower with the best 360° panorama of the old city and the Golden Horn.",
        "tags": ["views", "photography"],
      },
      {
        "name": "Süleymaniye Mosque",
        "category": "RELIGIOUS",
        "rank": 7,
        "lat": 41.0165,
        "lon": 28.9639,
        "description": "Sinan's masterpiece crowning the third hill — quieter than the Blue Mosque, grander inside.",
        "tags": ["religious", "architecture", "views"],
      },
      {
        "name": "Dolmabahçe Palace",
        "category": "HISTORICAL",
        "rank": 8,
        "lat": 41.0392,
        "lon": 29.0004,
        "description": "The Ottomans' 19th-century European-style palace right on the Bosphorus waterfront.",
        "tags": ["history", "architecture"],
      },
      {
        "name": "Spice Bazaar",
        "category": "MARKET",
        "rank": 9,
        "lat": 41.0166,
        "lon": 28.9709,
        "description": "Pyramids of spices, Turkish delight, and dried fruit by the Eminönü waterfront.",
        "tags": ["shopping", "food"],
      },
      {
        "name": "İstiklal Street & Taksim",
        "category": "LANDMARK",
        "rank": 10,
        "lat": 41.0335,
        "lon": 28.9777,
        "description": "The city's 1.4 km pedestrian artery — historic tram, arcades, churches, and street food.",
        "tags": ["shopping", "food", "photography"],
      },
      {
        "name": "Hippodrome & Sultanahmet Square",
        "category": "HISTORICAL",
        "rank": 11,
        "lat": 41.0058,
        "lon": 28.9758,
        "description": "The Byzantine chariot-racing arena, now a plaza with Egyptian and serpent obelisks.",
        "tags": ["history"],
      },
      {
        "name": "Chora Church (Kariye)",
        "category": "RELIGIOUS",
        "rank": 12,
        "lat": 41.0311,
        "lon": 28.939,
        "description": "The finest surviving Byzantine mosaics and frescoes anywhere — worth the detour.",
        "tags": ["history", "art", "religious"],
      },
    ],
  },
  // … 7 more cities, structure identical
]
```

Locked must-go lists for the remaining cities (the curation decision — implementer supplies coordinates, descriptions, tags per the template; cut nothing, add nothing without flagging it for Burak's review):

- **BER, Berlin, Germany, center 52.52/13.405, Europe/Berlin** — Brandenburg Gate (LANDMARK), Reichstag Building (LANDMARK), Museum Island (MUSEUM), Memorial to the Murdered Jews of Europe (HISTORICAL), East Side Gallery (HISTORICAL), Berlin Wall Memorial — Bernauer Straße (HISTORICAL), Checkpoint Charlie (HISTORICAL), Berliner Dom (RELIGIOUS), TV Tower — Alexanderplatz (VIEWPOINT), Tiergarten (PARK), Charlottenburg Palace (HISTORICAL), Gendarmenmarkt (LANDMARK)
- **WAW, Warsaw, Poland, center 52.2297/21.0122, Europe/Warsaw** — Old Town Market Square (LANDMARK), Royal Castle (HISTORICAL), Łazienki Park (PARK), Warsaw Uprising Museum (MUSEUM), POLIN Museum of the History of Polish Jews (MUSEUM), Palace of Culture and Science (VIEWPOINT), Wilanów Palace (HISTORICAL), Copernicus Science Centre (MUSEUM), Krakowskie Przedmieście (LANDMARK), Holy Cross Church (RELIGIOUS), Warsaw Barbican (HISTORICAL)
- **BUD, Budapest, Hungary, center 47.4979/19.0402, Europe/Budapest** — Hungarian Parliament Building (LANDMARK), Buda Castle (HISTORICAL), Fisherman's Bastion (VIEWPOINT), Matthias Church (RELIGIOUS), St. Stephen's Basilica (RELIGIOUS), Széchenyi Chain Bridge (LANDMARK), Széchenyi Thermal Baths (LANDMARK), Heroes' Square (LANDMARK), Great Market Hall (MARKET), Gellért Hill & Citadella (VIEWPOINT), Dohány Street Synagogue (RELIGIOUS), Shoes on the Danube Bank (HISTORICAL)
- **LHR (altCodes: ["LGW"]), London, United Kingdom, center 51.5074/-0.1278, Europe/London** — Tower of London (HISTORICAL), Tower Bridge (LANDMARK), British Museum (MUSEUM), Westminster Abbey (RELIGIOUS), Big Ben & Houses of Parliament (LANDMARK), Buckingham Palace (LANDMARK), London Eye (VIEWPOINT), National Gallery & Trafalgar Square (MUSEUM), St Paul's Cathedral (RELIGIOUS), Hyde Park (PARK), Borough Market (MARKET), Natural History Museum (MUSEUM)
- **CDG (altCodes: ["ORY"]), Paris, France, center 48.8566/2.3522, Europe/Paris** — Eiffel Tower (LANDMARK), Louvre Museum (MUSEUM), Notre-Dame Cathedral (RELIGIOUS), Sacré-Cœur & Montmartre (RELIGIOUS), Arc de Triomphe (LANDMARK), Champs-Élysées (LANDMARK), Musée d'Orsay (MUSEUM), Sainte-Chapelle (RELIGIOUS), Luxembourg Gardens (PARK), Panthéon (HISTORICAL), Centre Pompidou (MUSEUM), Trocadéro (VIEWPOINT)
- **FCO, Rome, Italy, center 41.9028/12.4964, Europe/Rome** — Colosseum (HISTORICAL), Roman Forum & Palatine Hill (HISTORICAL), Pantheon (HISTORICAL), Trevi Fountain (LANDMARK), Spanish Steps (LANDMARK), Piazza Navona (LANDMARK), Vatican Museums & Sistine Chapel (MUSEUM), St. Peter's Basilica (RELIGIOUS), Castel Sant'Angelo (HISTORICAL), Galleria Borghese (MUSEUM), Campo de' Fiori (MARKET), Trastevere (LANDMARK)
- **BCN, Barcelona, Spain, center 41.3874/2.1686, Europe/Madrid** — Sagrada Família (RELIGIOUS), Park Güell (PARK), Casa Batlló (LANDMARK), Casa Milà — La Pedrera (LANDMARK), La Rambla (LANDMARK), Gothic Quarter & Barcelona Cathedral (HISTORICAL), La Boqueria Market (MARKET), Picasso Museum (MUSEUM), Montjuïc & Magic Fountain (VIEWPOINT), Palau de la Música Catalana (LANDMARK), Bunkers del Carmel (VIEWPOINT), Barcelona Beach — Barceloneta (PARK)

Note: the final file is plain `.json` — no comments allowed (the `jsonc` above is illustration only).

- [ ] **Step 5: Run the QA test until green**

Run: `pnpm --filter @smartroute/backend exec vitest run tests/services/plan/seed-data.test.ts`
Expected: PASS (6 tests). Fix any coordinate/rank/category violations it reports.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/services/plan/seed-schema.ts apps/backend/tests/services/plan/seed-data.test.ts apps/backend/prisma/seed/attractions.json
git commit -m "feat(backend): curated must-go dataset for 8 cities + seed schema and data QA tests"
```

---

### Task 4: Seed loader

**Files:**

- Create: `apps/backend/prisma/seed.ts`
- Create: `apps/backend/tests/services/plan/seed-loader.test.ts`

- [ ] **Step 1: Write the failing test** `apps/backend/tests/services/plan/seed-loader.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { loadSeed } from '../../../prisma/seed.js';
import { prisma } from '../../setup-db.js';

const fixture = [
  {
    iata: 'IST',
    altCodes: [],
    name: 'Istanbul',
    country: 'Türkiye',
    lat: 41.0082,
    lon: 28.9784,
    timezone: 'Europe/Istanbul',
    attractions: Array.from({ length: 8 }, (_, i) => ({
      name: `Sight ${i + 1}`,
      category: 'LANDMARK' as const,
      rank: i + 1,
      lat: 41.0,
      lon: 28.98,
      description: 'A test attraction description.',
      tags: ['history'],
    })),
  },
];

describe('loadSeed', () => {
  it('inserts cities and attractions', async () => {
    await loadSeed(prisma, fixture);
    expect(await prisma.city.count()).toBe(1);
    expect(await prisma.attraction.count()).toBe(8);
  });

  it('is idempotent — re-running converges to the file state', async () => {
    await loadSeed(prisma, fixture);
    const renamed = [{ ...fixture[0]!, attractions: fixture[0]!.attractions.slice(0, 5) }];
    await loadSeed(prisma, renamed);
    expect(await prisma.city.count()).toBe(1);
    expect(await prisma.attraction.count()).toBe(5);
  });

  it('rejects invalid data before touching the DB', async () => {
    const bad = [{ ...fixture[0]!, attractions: [] }]; // min 8 violated
    await expect(loadSeed(prisma, bad)).rejects.toThrow();
    expect(await prisma.city.count()).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @smartroute/backend exec vitest run tests/services/plan/seed-loader.test.ts`
Expected: FAIL — cannot resolve `../../../prisma/seed.js`.

- [ ] **Step 3: Create `apps/backend/prisma/seed.ts`**

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @smartroute/backend exec vitest run tests/services/plan/seed-loader.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the real seed against the local DB and eyeball it**

Run: `pnpm --filter @smartroute/backend db:seed`
Expected: `Seeded attractions for all cities`, exit 0. Then `pnpm --filter @smartroute/backend exec prisma studio` (optional) or a quick psql count if curious.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/prisma/seed.ts apps/backend/tests/services/plan/seed-loader.test.ts
git commit -m "feat(backend): idempotent attraction seed loader with zod validation"
```

---

### Task 5: PlanService

**Files:**

- Create: `apps/backend/src/services/plan/index.ts`
- Create: `apps/backend/tests/services/plan/plan.test.ts`

- [ ] **Step 1: Write the failing tests** `apps/backend/tests/services/plan/plan.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { PlanService, visitOrder } from '../../../src/services/plan/index.js';
import { TripService } from '../../../src/services/trips/index.js';
import { loadSeed } from '../../../prisma/seed.js';
import { prisma } from '../../setup-db.js';
import type { Trip } from '@smartroute/shared';

function leg(origin: string, destination: string) {
  return {
    origin,
    destination,
    depart: '2026-07-01T08:00:00.000Z',
    arrive: '2026-07-01T12:00:00.000Z',
    carrier: 'XX',
    priceCents: 10_000,
    durationMin: 240,
    stops: 0,
  };
}

const tripInput = {
  name: 'Test trip',
  startDate: '2026-07-01',
  endDate: '2026-07-08',
  cabinClass: 'ECONOMY' as const,
  travelers: 1,
  cities: ['IST', 'BER', 'JFK'],
  flights: [leg('IST', 'BER'), leg('BER', 'JFK')],
  totalPriceCents: 20_000,
};

const seedFixture = [
  {
    iata: 'IST',
    altCodes: [],
    name: 'Istanbul',
    country: 'Türkiye',
    lat: 41.0082,
    lon: 28.9784,
    timezone: 'Europe/Istanbul',
    attractions: Array.from({ length: 8 }, (_, i) => ({
      name: `IST Sight ${i + 1}`,
      category: 'LANDMARK' as const,
      rank: i + 1,
      lat: 41.0,
      lon: 28.98,
      description: 'A test attraction description.',
      tags: ['history'],
    })),
  },
  {
    iata: 'LHR',
    altCodes: ['LGW'],
    name: 'London',
    country: 'United Kingdom',
    lat: 51.5074,
    lon: -0.1278,
    timezone: 'Europe/London',
    attractions: Array.from({ length: 8 }, (_, i) => ({
      name: `LON Sight ${i + 1}`,
      category: 'MUSEUM' as const,
      rank: i + 1,
      lat: 51.5,
      lon: -0.12,
      description: 'A test attraction description.',
      tags: ['art'],
    })),
  },
];

describe('visitOrder', () => {
  it('derives order from the flight-leg chain', () => {
    const t = { flights: [leg('IST', 'BER'), leg('BER', 'JFK')], cities: ['JFK', 'IST', 'BER'] };
    expect(visitOrder(t as unknown as Trip)).toEqual(['IST', 'BER', 'JFK']);
  });

  it('falls back to cities when flights are empty', () => {
    const t = { flights: [], cities: ['IST', 'BER'] };
    expect(visitOrder(t as unknown as Trip)).toEqual(['IST', 'BER']);
  });
});

describe('PlanService', () => {
  beforeEach(async () => {
    await loadSeed(prisma, seedFixture);
  });

  it('returns must-go lists in visiting order, unseeded cities marked unavailable', async () => {
    const trip = await new TripService(prisma).create('u1', tripInput);
    const plan = await new PlanService(prisma).planForTrip('u1', trip.id);

    expect(plan.tripId).toBe(trip.id);
    expect(plan.cities.map((c) => c.iata)).toEqual(['IST', 'BER', 'JFK']);

    const ist = plan.cities[0]!;
    expect(ist.available).toBe(true);
    expect(ist.name).toBe('Istanbul');
    expect(ist.mustGo).toHaveLength(8);
    expect(ist.mustGo[0]!.rank).toBe(1);

    const jfk = plan.cities[2]!;
    expect(jfk).toEqual({ iata: 'JFK', name: null, available: false, mustGo: [] });
  });

  it('resolves alternate airport codes to the same city', async () => {
    const trip = await new TripService(prisma).create('u1', {
      ...tripInput,
      cities: ['IST', 'LGW'],
      flights: [leg('IST', 'LGW')],
    });
    const plan = await new PlanService(prisma).planForTrip('u1', trip.id);
    const lgw = plan.cities[1]!;
    expect(lgw.iata).toBe('LGW');
    expect(lgw.available).toBe(true);
    expect(lgw.name).toBe('London');
    expect(lgw.mustGo).toHaveLength(8);
  });

  it('throws NOT_FOUND for another user trip', async () => {
    const trip = await new TripService(prisma).create('u1', tripInput);
    await expect(new PlanService(prisma).planForTrip('u2', trip.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @smartroute/backend exec vitest run tests/services/plan/plan.test.ts`
Expected: FAIL — cannot resolve `../../../src/services/plan/index.js`.

- [ ] **Step 3: Create `apps/backend/src/services/plan/index.ts`**

```ts
import type { PrismaClient } from '@prisma/client';
import type { Trip, TripPlanCity, TripPlanResponse, AttractionCategory } from '@smartroute/shared';
import { TripService } from '../trips/index.js';

export function visitOrder(trip: Trip): string[] {
  if (trip.flights.length > 0) {
    return [trip.flights[0]!.origin, ...trip.flights.map((f) => f.destination)];
  }
  return trip.cities;
}

export class PlanService {
  constructor(private readonly db: PrismaClient) {}

  async planForTrip(userId: string, tripId: string): Promise<TripPlanResponse> {
    const trip = await new TripService(this.db).findById(userId, tripId);
    const order = visitOrder(trip);

    const cities = await this.db.city.findMany({
      where: { OR: [{ iata: { in: order } }, { altCodes: { hasSome: order } }] },
      include: { attractions: { where: { mustGo: true }, orderBy: { rank: 'asc' } } },
    });

    const byCode = new Map<string, (typeof cities)[number]>();
    for (const c of cities) {
      byCode.set(c.iata, c);
      for (const alt of c.altCodes) byCode.set(alt, c);
    }

    return {
      tripId: trip.id,
      cities: order.map((iata): TripPlanCity => {
        const c = byCode.get(iata);
        if (!c) return { iata, name: null, available: false, mustGo: [] };
        return {
          iata,
          name: c.name,
          available: true,
          mustGo: c.attractions.map((a) => ({
            id: a.id,
            name: a.name,
            category: a.category as AttractionCategory,
            rank: a.rank,
            lat: a.lat,
            lon: a.lon,
            description: a.description,
          })),
        };
      }),
    };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @smartroute/backend exec vitest run tests/services/plan/plan.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/services/plan/index.ts apps/backend/tests/services/plan/plan.test.ts
git commit -m "feat(backend): PlanService — must-go plan per trip in visiting order"
```

---

### Task 6: Route `GET /trips/:id/plan`

**Files:**

- Modify: `apps/backend/src/routes/trips.route.ts`
- Create: `apps/backend/tests/routes/plan.route.test.ts`

- [ ] **Step 1: Write the failing route test** `apps/backend/tests/routes/plan.route.test.ts` (Clerk mock copied from `trips.route.test.ts` — route tests can't share it because `vi.mock` is per-file):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildServer } from '../../src/server.js';
import { loadSeed } from '../../prisma/seed.js';
import { prisma } from '../setup-db.js';

vi.mock('@clerk/backend', () => ({
  createClerkClient: () => ({
    authenticateRequest: vi.fn(async (req: Request) => {
      const auth = req.headers.get('authorization');
      if (auth?.startsWith('Bearer u_')) {
        return { isSignedIn: true, toAuth: () => ({ userId: auth.slice(7) }) };
      }
      return { isSignedIn: false, toAuth: () => null };
    }),
  }),
}));

const body = {
  name: 'Eurotrip',
  startDate: '2026-07-01',
  endDate: '2026-07-08',
  cabinClass: 'ECONOMY',
  travelers: 1,
  cities: ['IST', 'JFK'],
  flights: [
    {
      origin: 'IST',
      destination: 'JFK',
      depart: '2026-07-01T08:00:00.000Z',
      arrive: '2026-07-01T19:00:00.000Z',
      carrier: 'XX',
      priceCents: 50_000,
      durationMin: 660,
      stops: 0,
    },
  ],
  totalPriceCents: 50_000,
};

const seedFixture = [
  {
    iata: 'IST',
    altCodes: [],
    name: 'Istanbul',
    country: 'Türkiye',
    lat: 41.0082,
    lon: 28.9784,
    timezone: 'Europe/Istanbul',
    attractions: Array.from({ length: 8 }, (_, i) => ({
      name: `Sight ${i + 1}`,
      category: 'LANDMARK' as const,
      rank: i + 1,
      lat: 41.0,
      lon: 28.98,
      description: 'A test attraction description.',
      tags: ['history'],
    })),
  },
];

describe('GET /trips/:id/plan', () => {
  beforeEach(async () => {
    process.env.CLERK_SECRET_KEY = 'sk_test_x';
    process.env.CLERK_PUBLISHABLE_KEY = 'pk_test_x';
    await loadSeed(prisma, seedFixture);
  });

  it('requires auth', async () => {
    const app = await buildServer({ withDb: true });
    const res = await app.inject({ method: 'GET', url: '/trips/whatever/plan' });
    expect(res.statusCode).toBe(401);
  });

  it('returns the plan for an owned trip', async () => {
    const app = await buildServer({ withDb: true });
    const auth = { authorization: 'Bearer u_alice', 'content-type': 'application/json' };

    const create = await app.inject({
      method: 'POST',
      url: '/trips',
      headers: auth,
      payload: body,
    });
    expect(create.statusCode).toBe(201);
    const id = create.json().id;

    const res = await app.inject({ method: 'GET', url: `/trips/${id}/plan`, headers: auth });
    expect(res.statusCode).toBe(200);
    const plan = res.json();
    expect(plan.tripId).toBe(id);
    expect(plan.cities).toHaveLength(2);
    expect(plan.cities[0]).toMatchObject({ iata: 'IST', available: true });
    expect(plan.cities[0].mustGo).toHaveLength(8);
    expect(plan.cities[1]).toMatchObject({ iata: 'JFK', available: false, mustGo: [] });
  });

  it('404s for another user trip', async () => {
    const app = await buildServer({ withDb: true });
    const create = await app.inject({
      method: 'POST',
      url: '/trips',
      headers: { authorization: 'Bearer u_alice', 'content-type': 'application/json' },
      payload: body,
    });
    const id = create.json().id;
    const res = await app.inject({
      method: 'GET',
      url: `/trips/${id}/plan`,
      headers: { authorization: 'Bearer u_bob' },
    });
    expect(res.statusCode).toBe(404);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @smartroute/backend exec vitest run tests/routes/plan.route.test.ts`
Expected: "returns the plan" and "404s" FAIL with 404 on the `/plan` URL (route doesn't exist); "requires auth" may already pass.

- [ ] **Step 3: Add the route** — in `apps/backend/src/routes/trips.route.ts`, add the import and a handler before the `delete` handler:

```ts
import { PlanService } from '../services/plan/index.js';
```

```ts
app.get<{ Params: { id: string } }>(
  '/trips/:id/plan',
  { preHandler: [app.requireAuth] },
  async (req) => new PlanService(app.prisma).planForTrip(req.userId, req.params.id),
);
```

- [ ] **Step 4: Run the whole backend suite**

Run: `pnpm --filter @smartroute/backend test`
Expected: all tests pass (55 old + ~17 new).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/routes/trips.route.ts apps/backend/tests/routes/plan.route.test.ts
git commit -m "feat(backend): GET /trips/:id/plan endpoint"
```

---

### Task 7: CI + docs

**Files:**

- Modify: `.github/workflows/ci.yml`
- Modify: `README.md`

- [ ] **Step 1: Add a seed step to CI** — in `.github/workflows/ci.yml`, after the "Build shared package" step (the seed imports `@smartroute/shared`, so shared must be built first), insert:

```yaml
- name: Seed attractions (validates dataset against real schema)
  run: pnpm --filter @smartroute/backend db:seed
```

- [ ] **Step 2: Update README** — in "Getting started", after the `db:migrate` line add:

```bash
pnpm --filter @smartroute/backend db:seed   # load must-go attractions (8 cities)
```

and in "Backend endpoints" add:

```markdown
- `GET /trips/:id/plan` — auth required; per-city must-go attractions for a saved trip, in visiting order
```

- [ ] **Step 3: Format check** (Prettier covers yml/md — this is what broke CI last time)

Run: `pnpm format:check`
Expected: clean. If not: `pnpm format` and re-check.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml README.md
git commit -m "ci: seed attractions in CI; document db:seed and /plan endpoint"
```

---

### Task 8: Mobile API + hook

**Files:**

- Create: `apps/mobile/src/api/plan.ts`
- Create: `apps/mobile/src/hooks/useTripPlan.ts`

- [ ] **Step 1: Create `apps/mobile/src/api/plan.ts`**

```ts
import type { TripPlanResponse } from '@smartroute/shared';
import { apiFetch, type GetToken } from './client';

export function getTripPlan(id: string, getToken: GetToken): Promise<TripPlanResponse> {
  return apiFetch<TripPlanResponse>(`/trips/${id}/plan`, { method: 'GET' }, getToken);
}
```

- [ ] **Step 2: Create `apps/mobile/src/hooks/useTripPlan.ts`** (same shape as `useTrip` in `useTrips.ts`):

```ts
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import type { TripPlanResponse } from '@smartroute/shared';
import { getTripPlan } from '../api/plan';

export function useTripPlan(id: string) {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const [plan, setPlan] = useState<TripPlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getTripPlan(id, () => getTokenRef.current())
      .then((p) => active && setPlan(p))
      .catch((e) => active && setError((e as Error).message));
    return () => {
      active = false;
    };
  }, [id]);

  return { plan, error };
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/api/plan.ts apps/mobile/src/hooks/useTripPlan.ts
git commit -m "feat(mobile): trip-plan API client and hook"
```

---

### Task 9: TripPlanScreen + navigation

**Files:**

- Create: `apps/mobile/src/screens/TripPlanScreen.tsx`
- Modify: `apps/mobile/src/navigation/RootNavigator.tsx`
- Modify: `apps/mobile/src/screens/TripDetailScreen.tsx`

- [ ] **Step 1: Create `apps/mobile/src/screens/TripPlanScreen.tsx`**

```tsx
import {
  Linking,
  Platform,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import type { Attraction, TripPlanCity } from '@smartroute/shared';
import { Screen } from '../components/Screen';
import { useTripPlan } from '../hooks/useTripPlan';
import type { RootStackParamList } from '../navigation/RootNavigator';

const CATEGORY_META: Record<Attraction['category'], { emoji: string; label: string }> = {
  LANDMARK: { emoji: '📍', label: 'Landmark' },
  MUSEUM: { emoji: '🏛️', label: 'Museum' },
  RELIGIOUS: { emoji: '🕌', label: 'Religious' },
  PARK: { emoji: '🌳', label: 'Park' },
  VIEWPOINT: { emoji: '🌆', label: 'Viewpoint' },
  HISTORICAL: { emoji: '🏰', label: 'Historical' },
  MARKET: { emoji: '🛍️', label: 'Market' },
};

function openInMaps(a: Attraction): void {
  // Platform.select's return type is T | undefined even with a default key
  const url =
    Platform.OS === 'ios'
      ? `http://maps.apple.com/?ll=${a.lat},${a.lon}&q=${encodeURIComponent(a.name)}`
      : `geo:${a.lat},${a.lon}?q=${encodeURIComponent(a.name)}`;
  void Linking.openURL(url);
}

type PlanSection = { title: string; available: boolean; data: Attraction[] };

export function TripPlanScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'TripPlan'>>();
  const { plan, error } = useTripPlan(route.params.id);

  if (error)
    return (
      <Screen>
        <Text style={styles.error}>{error}</Text>
      </Screen>
    );
  if (!plan)
    return (
      <Screen>
        <Text style={styles.loading}>Loading…</Text>
      </Screen>
    );

  const sections: PlanSection[] = plan.cities.map((c: TripPlanCity, i: number) => ({
    title: `${i + 1}. ${c.name ?? c.iata}`,
    available: c.available,
    data: c.mustGo,
  }));

  return (
    <Screen>
      <SectionList<Attraction, PlanSection>
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        renderSectionFooter={({ section }) =>
          section.available ? null : (
            <Text style={styles.unavailable}>No guide for this city yet.</Text>
          )
        }
        renderItem={({ item }) => {
          const meta = CATEGORY_META[item.category];
          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.chip}>
                  {meta.emoji} {meta.label}
                </Text>
              </View>
              <Text style={styles.description}>{item.description}</Text>
              <TouchableOpacity onPress={() => openInMaps(item)}>
                <Text style={styles.mapsLink}>Open in maps →</Text>
              </TouchableOpacity>
            </View>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
  },
  unavailable: { color: '#94A3B8', fontStyle: 'italic', marginBottom: 12 },
  card: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    marginBottom: 8,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontWeight: '600', color: '#0F172A', fontSize: 15, flexShrink: 1 },
  chip: { color: '#475569', fontSize: 12, marginLeft: 8 },
  description: { color: '#475569', marginTop: 4 },
  mapsLink: { color: '#0D9488', fontWeight: '600', marginTop: 8 },
  loading: { color: '#64748B' },
  error: { color: '#DC2626' },
});
```

- [ ] **Step 2: Register the route** — in `apps/mobile/src/navigation/RootNavigator.tsx`:

Add to `RootStackParamList`:

```ts
TripPlan: {
  id: string;
}
```

Add the import:

```ts
import { TripPlanScreen } from '../screens/TripPlanScreen';
```

Add inside the signed-in fragment, after the `TripDetail` screen:

```tsx
<Stack.Screen name="TripPlan" component={TripPlanScreen} options={{ title: 'Trip plan' }} />
```

- [ ] **Step 3: Add the button** — in `apps/mobile/src/screens/TripDetailScreen.tsx`:

Add imports:

```ts
import { Button } from 'react-native'; // extend the existing react-native import list
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
```

Inside the component, next to the existing `useRoute` call:

```ts
const nav = useNavigation<NativeStackNavigationProp<RootStackParamList, 'TripDetail'>>();
```

In the JSX, directly after the `<RouteMap …/>` view block:

```tsx
<View style={{ marginBottom: 16 }}>
  <Button title="Plan trip" onPress={() => nav.navigate('TripPlan', { id: trip.id })} />
</View>
```

- [ ] **Step 4: Typecheck + lint + format**

Run: `pnpm typecheck && pnpm lint && pnpm format:check`
Expected: all exit 0 (run `pnpm format` first if format:check complains).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/screens/TripPlanScreen.tsx apps/mobile/src/navigation/RootNavigator.tsx apps/mobile/src/screens/TripDetailScreen.tsx
git commit -m "feat(mobile): TripPlanScreen with per-city must-go sections"
```

---

### Task 10: Full verification + smoke test

- [ ] **Step 1: Full local pipeline (what CI runs)**

Run: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test`
Expected: everything green (~72 backend tests).

- [ ] **Step 2: iPhone smoke test** (requires Burak; hotspot networking per memory — update `apps/mobile/.env` `EXPO_PUBLIC_API_URL` to the laptop's hotspot IP if it changed):

1. `docker compose up -d`, `pnpm --filter @smartroute/backend db:seed`, start backend + Expo.
2. Open a saved trip containing IST/BER (or create + save one) → tap **Plan trip**.
3. Verify: city sections in visiting order, ~12 attraction cards each, ranked canon first.
4. Tap **Open in maps** on Hagia Sophia → Apple Maps opens at the correct pin (this is the coordinate-accuracy spot check).
5. A trip containing JFK shows "No guide for this city yet." under the JFK header.

- [ ] **Step 3: Burak reviews the dataset** — `git diff main -- apps/backend/prisma/seed/attractions.json` or read the file; edit any entries to taste; re-run `pnpm --filter @smartroute/backend test` (data QA) after edits.

- [ ] **Step 4: Final commit + push (user pushes — classifier blocks direct push)**

```bash
git add -A && git commit -m "feat: Plan 6 — trip planning layer, must-go attractions" # only if anything uncommitted
# Burak: ! git push origin main
```

- [ ] **Step 5: Verify CI green** — `gh run list --limit 1` after push.
