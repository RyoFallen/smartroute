# SmartRoute Plan 6 — Trip Planning Layer: Must-Go Attractions

**Date:** 2026-06-12
**Status:** Approved (pending user spec review)
**Owner:** Burak Berk Yılmaz

## 1. Purpose

After a user saves a trip, they can open it and tap **"Plan trip"** to see, for each city in visiting order, the canonical **must-go attractions** — the places every visitor should see regardless of taste (Hagia Sophia in Istanbul, Brandenburg Gate in Berlin).

This is the first slice of the trip-planning half of SmartRoute. It deliberately ships **without** preferences: the goal is to prove the data model, seed pipeline, endpoint, and screen end-to-end. Preference capture ("might-like" recommendations, Plan 7) and the Tinder-style swipe UI (Plan 8) build on top of this foundation without schema changes to what Plan 6 introduces.

## 2. Goals & Non-Goals

### Goals (Plan 6)

- A curated, version-controlled attractions dataset for 8 starter cities: **Istanbul, Berlin, Warsaw, Budapest, London, Paris, Rome, Barcelona** (~10–15 must-go entries each).
- A repeatable seed pipeline (`prisma/seed.ts`) that loads the dataset idempotently.
- `GET /trips/:id/plan` — authenticated, ownership-checked, returns per-city must-go lists in **visiting order**.
- A `TripPlanScreen` in mobile: one section per city, attraction cards with "open in maps".
- Graceful handling of cities we have no data for (most of the world, in v0).

### Non-Goals (deferred)

- Preference questions / profiles, "might-like" filtering (Plan 7).
- Swipe-card UI (Plan 8).
- Food, nightlife, restaurants — different data problem, still under investigation.
- Attraction photos (`imageUrl` etc.) — text-first v0.
- Day-by-day scheduling, opening hours, ticket prices.
- Admin UI for editing attractions — the JSON file in git **is** the editing UI.
- Warsaw/Budapest airport codes in the mobile picker (WAW/BUD missing from `airports.ts`) — belongs to Plan 3.5 UI work, noted here only because demo trips will otherwise skip two seeded cities.

## 3. Decisions Locked In

| Decision        | Choice                                                                                              |
| --------------- | --------------------------------------------------------------------------------------------------- |
| Two-tier output | `mustGo` now; `mightLike` added beside it in Plan 7 — response shape designed for that from day one |
| Data source     | Hand-curated JSON committed to the repo. No LLM-generated content at runtime, no external POI API   |
| Curation        | First draft generated from well-known canon, Burak reviews/edits per city in the diff               |
| City model      | Adopt the existing (currently unused) `City` Prisma model — extend, don't duplicate                 |
| Visit order     | Derived from the saved trip's `flights` leg chain (authoritative), falling back to `cities` array   |
| Category field  | `String` in Prisma + zod enum in `@smartroute/shared` (repo convention — same as `cabinClass`)      |

## 4. Data Model

### 4.1 Prisma schema changes

The existing `City` model keeps all its columns (`iata` PK, `name`, `country`, `lat`, `lon`, `timezone`) and gains only the Prisma back-reference `attractions Attraction[]` (relation field, no DB column). One new model:

```prisma
model Attraction {
  id          String   @id @default(cuid())
  cityIata    String
  name        String
  category    String   // zod-validated: AttractionCategory
  mustGo      Boolean  @default(true)
  rank        Int      // 1 = most iconic; display order within a city
  lat         Float
  lon         Float
  description String   // 1–2 sentences, shown on the card
  tags        String[] // unused in Plan 6 responses; powers Plan 7 might-like filtering
  city        City     @relation(fields: [cityIata], references: [iata])

  @@unique([cityIata, name])
  @@index([cityIata, mustGo, rank])
}
```

`mustGo` is always `true` in the Plan 6 seed. Plan 7 adds `mustGo: false` rows (the might-like pool) without a migration.

### 4.2 Shared schemas (`packages/shared`)

New file `src/attractions.ts`:

```ts
export const AttractionCategory = z.enum([
  'LANDMARK',
  'MUSEUM',
  'RELIGIOUS',
  'PARK',
  'VIEWPOINT',
  'HISTORICAL',
  'MARKET',
]);

export const Attraction = z.object({
  id: z.string(),
  name: z.string(),
  category: AttractionCategory,
  rank: z.number().int().positive(),
  lat: z.number(),
  lon: z.number(),
  description: z.string(),
});

export const TripPlanCity = z.object({
  iata: Iata,
  name: z.string().nullable(), // null when city not in our DB
  available: z.boolean(), // false => "guide coming soon"
  mustGo: z.array(Attraction), // empty when !available
});

export const TripPlanResponse = z.object({
  tripId: z.string(),
  cities: z.array(TripPlanCity), // in visiting order
});
```

### 4.3 Seed dataset

`apps/backend/prisma/seed/attractions.json` — one entry per city, attractions nested (easiest shape for human review):

```jsonc
[
  {
    "iata": "IST",
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
        "lon": 28.9802,
        "description": "Byzantine cathedral turned mosque, 1500 years of history under one dome.",
        "tags": ["history", "architecture", "religious"],
      },
      // … 10–15 per city
    ],
  },
  // … 8 cities
]
```

City `lat`/`lon` here are the **city center** (used later for map centering), distinct from each attraction's coordinates.

### 4.4 Seed pipeline

- `apps/backend/prisma/seed.ts`, wired via `"prisma": { "seed": "tsx prisma/seed.ts" }` in the backend `package.json`; runnable as `pnpm --filter @smartroute/backend db:seed`.
- Validates the entire JSON against the shared zod schemas **before** touching the DB — a typo in my drafted data fails loudly, not silently.
- Idempotent per city: upsert `City`, then replace its attractions (`deleteMany` + `createMany` in a transaction). Re-running after editing the JSON converges to the file's state.
- CI runs `db:seed` right after `prisma migrate deploy` — not for the tests (unit tests use small inline fixtures), but to prove on every push that the real dataset loads cleanly against the real schema (FK violations, constraint breaks, and bad data fail CI even if no test touches the DB).

## 5. API

### `GET /trips/:id/plan` (auth required)

1. Load trip via the existing `TripService.findById(userId, id)` — same 404-on-missing-or-foreign-trip behaviour as `GET /trips/:id`.
2. Derive visiting order from `trip.flights`: `[legs[0].origin, ...legs.map(l => l.destination)]`. If `flights` is empty (defensive), fall back to `trip.cities` as stored.
3. Single query: all attractions where `cityIata IN (order) AND mustGo = true`, plus the matching `City` rows.
4. Respond with `TripPlanResponse` — one `TripPlanCity` per visited city **in order**; unseeded cities get `available: false, mustGo: []`.

No new error codes. `NOT_FOUND` (404) for missing/foreign trips, standard auth 401. A trip where _zero_ cities have data still returns 200 — the screen communicates coverage, not the API.

New `PlanService` in `src/services/plan/` (constructor-injected `PrismaClient`, same shape as `TripService`). Route registered in `src/routes/trips.route.ts` alongside the other `/trips` endpoints.

## 6. Mobile

- **TripDetailScreen**: add a primary **"Plan trip"** button → navigates to `TripPlan` route (new entry in `RootStackParamList`).
- **TripPlanScreen** (new): fetches `GET /trips/:id/plan` via a `useTripPlan` hook (same pattern as existing hooks). Renders a `SectionList`:
  - Section header: `1. Istanbul` (visit-order number + city name; IATA when `name` is null).
  - Item: attraction card — name, category chip (emoji + label, e.g. 🕌 Religious, 🏛 Museum), description, "Open in maps" link using the same `maps.apple.com` / `geo:` URL scheme as `RouteMap`, pointed at the attraction's `lat`/`lon`.
  - `available: false` section renders a single muted "No guide for this city yet" row.
- Loading / error states follow the existing screens' inline pattern.

## 7. Testing

- **Seed data QA test**: a vitest test imports `attractions.json` and zod-parses every entry — catches category typos, missing coords, duplicate names per city. This is the automated half of "Burak reviews the data"; the human half is the PR diff.
- **PlanService unit tests** (mocked Prisma, repo style): visiting-order derivation from flights chain; fallback to `cities`; unseeded city → `available: false`; foreign/missing trip → 404 via TripService.
- **Route test**: 401 without JWT; 200 shape matches `TripPlanResponse` with auth.
- **Seed idempotency test**: running the loader transform twice converges (pure-function part tested without a DB).
- Existing 55 tests must stay green.

## 8. Smoke Test (definition of done)

On the iPhone: open the saved Istanbul→Berlin trip (or create one) → Plan trip → see ordered city sections with ~10+ attractions each, tap "Open in maps" on Hagia Sophia → Apple Maps opens at the correct pin. A trip containing an unseeded city (e.g. JFK) shows the "no guide yet" row instead of breaking.

## 9. Future Hooks (not built now, shaped for)

- **Plan 7**: `UserPreference` model + `mightLike: Attraction[]` added to `TripPlanCity` (additive, non-breaking); `tags` + `mustGo: false` rows start mattering.
- **Plan 8**: swipe UI writes the same preference profile; backend untouched.
- Dataset growth: adding a city = appending JSON + `db:seed`. No code changes.
